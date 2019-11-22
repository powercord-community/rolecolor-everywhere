const { React, Flux, getModule, getAllModules, getModuleByDisplayName } = require('powercord/webpack');
const { waitFor, getOwnerInstance } = require('powercord/util');
const { inject, uninject } = require('powercord/injector');
const { Plugin } = require('powercord/entities');
const { resolve } = require('path');

const Settings = require('./Settings');

module.exports = class RoleColorEverywhere extends Plugin {
  async startPlugin () {
    this.loadCSS(resolve(__dirname, 'style.css'));
    this.registerSettings('rceverywhere', 'Role Color Everywhere', Settings);

    this.currentUser = await getModule([ 'getCurrentUser' ]);
    this.members = await getModule([ 'getMember' ]);
    this.channels = await getModule([ 'getChannel' ]);
    this.guilds = await getModule([ 'getGuild' ]);
    this.currentGuild = await getModule([ 'getGuildId' ]);
    this.injectAccount();
    this.injectVoice();
    this.injectMentions();
    this.injectTyping();
    this.injectMemberList();
    this.injectMessages();
    this.injectStatus();
  }

  pluginWillUnload () {
    uninject('rce-account');
    uninject('rce-voice');
    uninject('rce-mentions');
    uninject('rce-typing');
    uninject('rce-members');
    uninject('rce-messages');
    uninject('rce-status');
  }

  async injectAccount () {
    const _this = this;
    const { container } = await getModule([ 'container', 'usernameContainer' ]);
    const Account = getOwnerInstance(await waitFor(`.${container.split(' ').join('.')}:not(#powercord-spotify-modal)`));
    await inject('rce-account', Account.__proto__, 'renderNameTag', (_, res) => {
      if (!_this.settings.get('account', true)) {
        return res;
      }

      const originalChildren = res.props.children;
      res.props.children = (props) => {
        const res = originalChildren(props);
        const usernameComponent = ({ guildId, children }) => {
          if (!guildId) {
            return children;
          }

          const currentId = _this.currentUser.getCurrentUser().id;
          const member = _this.members.getMember(guildId, currentId);
          if (member.colorString) {
            return React.createElement('span', {
              style: { color: member.colorString }
            }, children);
          }
          return children;
        };

        const ConnectedComponent = Flux.connectStores([ _this.currentGuild ], () => ({ guildId: _this.currentGuild.getGuildId() }))(usernameComponent);
        const originalUsername = res.props.children[0].props.children.props.children;
        res.props.children[0].props.children.props.children = React.createElement(ConnectedComponent, null, originalUsername);
        return res;
      };
      return res;
    });
  }

  async injectVoice () {
    const _this = this;
    const VoiceUser = await getModuleByDisplayName('VoiceUser');
    await inject('rce-voice', VoiceUser.prototype, 'render', function (_, res) {
      if (!_this.settings.get('voice', true)) {
        return res;
      }

      const guildId = _this.currentGuild.getGuildId();
      const userId = this.props.user.id;
      const member = _this.members.getMember(guildId, userId);
      if (member && member.colorString) {
        res.props.children.props.children[2].props.style = { color: member.colorString };
      }
      return res;
    });
  }

  async injectMentions () {
    const module = await getModule([ 'parse', 'parseTopic' ]);
    await inject('rce-mentions', module, 'parse', ([ original, , { channelId } ], res) => {
      if (!this.settings.get('mentions', true)) {
        return res;
      }

      const parsed = [ ...res ];
      res.forEach((part, i) => {
        if (typeof part === 'string') {
          original = original.slice(part.length);
        } else {
          const originalSplit = original.split('>');
          const mention = originalSplit.shift();
          original = originalSplit.join('>');
          if (part.type.displayName === 'DeprecatedPopout' && part.props.children.type && part.props.children.type.displayName === 'Mention') {
            const match = mention.match(/(\d+)/);
            if (match) {
              const userId = match[1];
              const guildId = this.channels.getChannel(channelId).guild_id;
              const member = this.members.getMember(guildId, userId);
              if (member && member.colorString) {
                const colorInt = parseInt(member.colorString.slice(1), 16);
                const newPart = { ...part };
                newPart.props.children.props.style = {
                  '--color': member.colorString,
                  '--hoveredColor': this._numberToTextColor(colorInt),
                  '--backgroundColor': this._numberToRgba(colorInt, 0.1)
                };
                newPart.props.children.props.className += ' rolecolor-mention';
                parsed[i] = newPart;
              }
            }
          }
        }
      });
      return parsed;
    });
  }

  async injectTyping () {
    const _this = this;
    const typing = await getModule([ 'typing', 'activityInviteEducation' ]);
    const instance = getOwnerInstance(await waitFor(`.${typing.typing.replace(/ /g, '.')}`));
    inject('rce-typing', instance.__proto__, 'render', function (args, res) {
      if (!res || !this.props.channel.guild_id || !_this.settings.get('typing', true)) {
        return res;
      }

      const currentId = _this.currentUser.getCurrentUser().id;
      Object.keys(this.props.typingUsers).filter(id => id !== currentId).forEach((id, i) => {
        const member = _this.members.getMember(this.props.channel.guild_id, id);
        if (member.colorString) {
          res.props.children[1].props.children[i * 2].props.style = { color: member.colorString };
        }
      });
      return res;
    });
    instance.forceUpdate();
  }

  async injectMemberList () {
    const _this = this;
    const members = await getModule([ 'members', 'membersWrap' ]);
    const { container } = (await getAllModules(m => Object.keys(m).join('') === 'container'))[0];
    const instance = getOwnerInstance(await waitFor(`.${members.membersWrap.replace(/ /g, '.')}`));
    inject('rce-members', instance.__proto__, 'render', function (args, res) {
      if (!_this.settings.get('members', true) || !res.props.children.props) {
        return res;
      }

      const guild = _this.guilds.getGuild(this.props.channel.guild_id);
      const func = res.props.children.props.renderSection;
      res.props.children.props.renderSection = (a) => {
        let section = func(a);
        if (section.props.tutorialId) {
          section = section.props.children;
        }
        if (!(/\d+/).test(section.props.id)) {
          return section;
        }

        const role = guild.roles[section.props.id];
        if (role.color === 0) {
          return section;
        }

        return React.createElement('div', {
          className: [ container, members.membersGroup ].join(' '),
          style: {
            color: _this._numberToRgba(role.color)
          }
        }, `${section.props.title}—${section.props.count}`);
      };
      return res;
    });
    instance.forceUpdate();
  }

  async injectMessages () {
    const _this = this;
    const MessageContent = await getModuleByDisplayName('MessageContent');
    await inject('rce-messages', MessageContent.prototype, 'render', function (args) {
      if (!_this.settings.get('messages', true) || this.props.__rce_henlo) {
        return args;
      }

      this.props.__rce_henlo = true;
      if (this.props.message.colorString) {
        this.props.content = [ React.createElement('span', {
          className: 'rolecolor-message',
          style: {
            color: this.props.message.colorString
          }
        }, this.props.content) ];
      }
      return args;
    }, true);
  }

  async injectStatus () {
    const _this = this;
    const MemberListItem = await getModuleByDisplayName('MemberListItem');
    await inject('rce-status', MemberListItem.prototype, 'renderActivity', function (args, res) {
      if (!_this.settings.get('status', true) || !this.props.guildId) {
        return res;
      }

      const member = _this.members.getMember(this.props.guildId, this.props.user.id);
      if (member && member.colorString) {
        return React.createElement('span', {
          className: 'rolecolor-activity',
          style: { '--color': member.colorString }
        }, res);
      }
      return res;
    });
  }

  _numberToRgba (color, alpha = 1) {
    const { r, g, b } = this._numberToRgb(color);
    if (alpha === 1) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  _numberToTextColor (color) {
    const { r, g, b } = this._numberToRgb(color);
    const bgDelta = (r * 0.299) + (g * 0.587) + (b * 0.114);
    return ((255 - bgDelta) < 105) ? '#000000' : '#ffffff';
  }

  _numberToRgb (color) {
    const r = (color & 0xFF0000) >>> 16;
    const g = (color & 0xFF00) >>> 8;
    const b = color & 0xFF;
    return {
      r,
      g,
      b
    };
  }
};
