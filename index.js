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
    this.injectTyping();
    this.injectMemberList();
    this.injectMessages();
    this.injectSystemMessages();
    this.injectSlateMention();
    this.injectStatus();
  }

  pluginWillUnload () {
    uninject('rce-account');
    uninject('rce-voice');
    uninject('rce-mentions');
    uninject('rce-typing');
    uninject('rce-members');
    uninject('rce-messages');
    uninject('rce-systemMessages');
    uninject('rce-slateMentions');
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
          if (member && member.colorString) {
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
        if (member.colorString && res.props.children[1].props.children[i * 2].props) {
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
    const instance = getOwnerInstance(await waitFor(`.${members.membersWrap}`));
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

        const originalType = section.type;
        section.type = (props) => {
          const res = originalType(props);
          res.props.children = React.createElement('span', { style: { color: _this._numberToRgba(role.color) } }, res.props.children);
          return res;
        };
        return section;
      };
      return res;
    });
    instance.forceUpdate();
  }

  async injectMessages () {
    const _this = this; // I think I could go with this, but it works that way, and i cba to change it
    const Message = await getModule(m => m.default && m.default.displayName === 'Message');
    await inject('rce-messages', Message, 'default', (args, res) => {
      if (!res.props.children[0].props.children[2] || !res.props.children[0].props.children[2].type.type || res.props.children[0].props.children[2].type.__rce_uwu) {
        return res;
      }

      res.props.children[0].props.children[2].type.__rce_uwu = 'owo';
      const renderer = res.props.children[0].props.children[2].type.type;
      res.props.children[0].props.children[2].type.type = (props) => {
        const content = renderer(props);
        // Color
        if (_this.settings.get('messages', true)) {
          content.props.style = {
            color: props.message.colorString
          };
        }

        // Mentions
        if (_this.settings.get('mentions', true) && !res.props.children[0].props.children[0]) {
          let i = 0;
          const ids = (props.message.content.match(/<@!?(\d+)>/g) || []).map(s => s.replace(/<@!?(\d+)>/g, '$1'));
          const parser = items => items.map(item => {
            if (item.type && item.type.displayName === 'DeprecatedPopout' && item.props.children.type && item.props.children.type.displayName === 'Mention') {
              const guildId = this.channels.getChannel(props.message.channel_id).guild_id;
              const member = this.members.getMember(guildId, ids[i]);
              if (member && member.colorString) {
                const colorInt = parseInt(member.colorString.slice(1), 16);
                item.props.children.props.style = {
                  '--color': member.colorString,
                  '--hoveredColor': this._numberToTextColor(colorInt),
                  '--backgroundColor': this._numberToRgba(colorInt, 0.1)
                };
                if (!item.props.children.props.className.includes('rolecolor-mention')) {
                  item.props.children.props.className += ' rolecolor-mention';
                }
              }
              i++;
            } else if (item.props && item.props.children && Array.isArray(item.props.children)) {
              item.props.children = parser(item.props.children);
            }
            return item;
          });

          if (Array.isArray(content.props.children[0])) {
            content.props.children[0] = parser(content.props.children[0]);
          }
        }
        return content;
      };
      res.props.children[0].props.children[2].type.type.displayName = renderer.displayName;
      return res;
    });
    Message.default.displayName = 'Message';
  }

  async injectSystemMessages () {
    const _this = this;
    const Message = await getModule(m => m.default && m.default.displayName === 'Message');
    await inject('rce-systemMessages', Message, 'default', (args, res) => {
      return res; // @TODO
      /* eslint-disable */
      if (!_this.settings.get('systemMessages', true) || !res.props.children[0] || !res.props.children[0].props.children[0] ||
        !res.props.children[0].props.children[0].props.message || res.props.children[0].props.children[0].props.message.type < 6) {
        return res;
      }

      const { props } = res.props.children[0].props.children[0];
      const author = this.members.getMember(props.channel.guild_id, props.message.author.id);
      if (!author || !author.colorString) {
        return res;
      }

      if (!res.props.children[0].props.children[0].type.type) {
        return res;
      }
      console.log(res.props.children[0].props.children[0].type.type);
      const renderer = res.props.children[0].props.children[0].type.type;
      res.props.children[0].type = (props) => {
        const res = renderer(props);
        const renderer2 = res.props.children.type;
        res.props.children.type = (props) => {
          const res = renderer2(props);
          if (res.type.prototype.render) {
            const OgType = res.type;
            console.log(OgType);
            res.type = class Component extends OgType {
              render () {
                const res = super.render();
                res.props.children[0].props.children = res.props.children[0].props.children.map(c => {
                  if (c && typeof c.type === 'function') {
                    c.props.style = {
                      color: author.colorString
                    };
                  }
                  return c;
                });
                return res;
              }
            };
          } else {
            const renderer3 = res.type;
            res.type = (props) => {
              const res = renderer3(props);
              res.props.children = res.props.children.map(c => {
                if (c && typeof c === 'object') {
                  c.props.style = {
                    color: author.colorString
                  };
                }
                return c;
              });
              return res;
            };
          }
          return res;
        };
        return res;
      };
      return res;
    });
    Message.default.displayName = 'Message';
  }

  async injectSlateMention () {
    const module = await getModule([ 'UserMention', 'RoleMention' ]);
    await inject('rce-slateMentions', module, 'UserMention', ([ { id, channel: { guild_id } } ], res) => {
      if (!this.settings.get('mentions', true)) {
        return res;
      }
      const ogChildren = res.props.children;
      res.props.children = (props) => {
        const res = ogChildren(props);
        const member = this.members.getMember(guild_id, id);
        if (member && member.colorString) {
          const colorInt = parseInt(member.colorString.slice(1), 16);
          res.props.style = {
            '--color': member.colorString,
            '--hoveredColor': this._numberToTextColor(colorInt),
            '--backgroundColor': this._numberToRgba(colorInt, 0.1)
          };
          res.props.className += ' rolecolor-mention';
          return res;
        }
        return res;
      };
      return res;
    });
    module.UserMention.displayName = 'UserMention';
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
