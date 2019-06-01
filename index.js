const { React, Flux, getModule, getModuleByDisplayName } = require('powercord/webpack');
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
  }

  pluginWillUnload () {
    uninject('rce-account');
    uninject('rce-voice');
    uninject('rce-mentions');
    uninject('rce-typing');
    uninject('rce-members');
  }

  async injectAccount () {
    const _this = this;
    const NameTag = await getModuleByDisplayName('NameTag');
    await inject('rce-account', NameTag.prototype, 'render', function (_, res) {
      if (!_this.settings.get('account', true)) {
        return res;
      }

      if (this.props.className.includes('accountDetails')) {
        const { className, children: username } = res.props.children[0].props;
        const usernameComponent = ({ guildId }) => {
          if (!guildId) {
            return React.createElement('span', { className }, username);
          }

          const currentId = _this.currentUser.getCurrentUser().id;
          const member = _this.members.getMember(guildId, currentId);
          if (member.colorString) {
            return React.createElement('span', {
              className,
              style: { color: member.colorString }
            }, username);
          }
          return React.createElement('span', { className }, username);
        };
        res.props.children[0] = React.createElement(
          Flux.connectStores([ _this.currentGuild ], () => ({ guildId: _this.currentGuild.getGuildId() }))(usernameComponent)
        );
      }
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
    await inject('rce-mentions', module, 'parse', ([ original, _, { channelId } ], res) => {
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
          if (part.type.displayName === 'Popout' && part.props.children.type && part.props.children.type.displayName === 'Mention') {
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
    const instance = getOwnerInstance(await waitFor(`.${members.membersWrap.replace(/ /g, '.')}`));
    inject('rce-members', instance.__proto__, 'render', function (args, res) {
      if (!_this.settings.get('members', true)) {
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
          className: members.membersGroup,
          style: {
            color: _this._numberToRgba(role.color)
          }
        }, `${section.props.title}—${section.props.count}`);
      };
      return res;
    });
    instance.forceUpdate();
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
