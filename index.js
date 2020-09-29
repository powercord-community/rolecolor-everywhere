/*
 * Copyright (c) 2020 Bowser65
 * Licensed under the Open Software License version 3.0
 */

const { React, Flux, getModule, getModuleByDisplayName } = require('powercord/webpack');
const { waitFor, getOwnerInstance } = require('powercord/util');
const { inject, uninject } = require('powercord/injector');
const { Plugin } = require('powercord/entities');

const Settings = require('./Settings');

module.exports = class RoleColorEverywhere extends Plugin {
  async startPlugin () {
    powercord.api.settings.registerSettings('rceverywhere', {
      category: this.entityID,
      label: 'Role Color Everywhere',
      render: Settings
    });

    this.loadStylesheet('style.css');

    this.currentUser = await getModule([ 'getCurrentUser' ]);
    this.members = await getModule([ 'getMember' ]);
    this.channels = await getModule([ 'getChannel' ]);
    this.guilds = await getModule([ 'getGuild' ]);
    this.currentGuild = await getModule([ 'getLastSelectedGuildId' ]);
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
    uninject('rce-typing');
    uninject('rce-members');
    uninject('rce-messages');
    uninject('rce-systemMessages-join');
    uninject('rce-systemMessages-boost');
    uninject('rce-slateMentions');
    uninject('rce-status');
    powercord.api.settings.unregisterSettings('rceverywhere');

    const classes = getModule([ 'container', 'usernameContainer' ], false);
    if (classes) {
      getOwnerInstance(document.querySelector(`.${classes.container}:not(#powercord-spotify-modal)`)).forceUpdate();
    }
  }

  async injectAccount () {
    const _this = this;
    const { container } = await getModule([ 'container', 'usernameContainer' ]);
    const Account = getOwnerInstance(await waitFor(`.${container}:not(#powercord-spotify-modal)`));
    inject('rce-account', Account.__proto__, 'renderNameTag', (_, res) => {
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
        res.props.children.props.children[2].props.className += ' rolecolor-colored';
        res.props.children.props.children[2].props.style = { '--color': member.colorString };
      }
      return res;
    });
  }

  async injectTyping () {
    const _this = this;
    const typing = await getModule([ 'typing', 'activityInviteEducation' ]);
    const blockedStore = await getModule([ 'isBlocked', 'isFriend' ]);
    const instance = getOwnerInstance(await waitFor(`.${typing.typing.replace(/ /g, '.')}`));
    inject('rce-typing', instance.__proto__, 'render', function (args, res) {
      if (!res || !this.props.channel.guild_id || !_this.settings.get('typing', true)) {
        return res;
      }

      const currentId = _this.currentUser.getCurrentUser().id;
      Object.keys(this.props.typingUsers).filter(id => id !== currentId && !blockedStore.isBlocked(id)).forEach((id, i) => {
        const member = _this.members.getMember(this.props.channel.guild_id, id);
        if (member.colorString && res.props.children[1].props.children[i * 2].props) {
          res.props.children[1].props.children[i * 2].props.className = 'rolecolor-colored';
          res.props.children[1].props.children[i * 2].props.style = { '--color': member.colorString };
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
    inject('rce-members', instance.__proto__, 'render', function (_, res) {
      if (!_this.settings.get('members', true) || !res.props.children?.props) {
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

        const originalType = section.type.type;
        section.type = (props) => {
          const res = originalType(props);
          res.props.children = React.createElement('span', {
            className: 'rolecolor-colored',
            style: { '--color': _this._numberToRgba(role.color) }
          }, res.props.children);
          return res;
        };
        return section;
      };
      return res;
    });
    instance.forceUpdate();
  }

  async injectMessages () {
    const MessageContent = await getModule(m => m.type?.displayName === 'MessageContent');
    inject('rce-messages', MessageContent, 'type', ([ props ], res) => {
      if (this.settings.get('messages', true)) {
        res.props.style = {
          color: props.message.colorString
        };
      }

      if (this.settings.get('mentions', true) && Array.isArray(res.props.children[0])) {
        const guildId = this.channels.getChannel(props.message.channel_id).guild_id;
        const colors = (props.message.content.match(/<@!?(\d+)>/g) || [])
          .map(m => this.members.getMember(guildId, m.replace(/[<@!>]/g, ''))?.colorString);

        res.props.children[0]
          .filter(c => c.props?.children?.type?.displayName === 'Mention' || c.type?.displayName === 'Mention')
          .map(c => c.props.className ? c : c.props.children)
          .forEach((m, i) => {
            if (colors[i]) {
              const colorInt = parseInt(colors[i].slice(1), 16);
              const { children } = m.props;
              m.props.className += ' rolecolor-mention';
              m.props.children = React.createElement('span', {
                style: {
                  '--color': colors[i],
                  '--hoveredColor': this._numberToTextColor(colorInt),
                  '--backgroundColor': this._numberToRgba(colorInt, 0.1)
                }
              }, children);
            }
          });
      }
      return res;
    });
  }

  async injectSystemMessages () {
    const _this = this;
    const UserJoin = await getModule(m => m.default?.displayName === 'UserJoin');
    const UserPremiumGuildSubscription = await getModuleByDisplayName('UserPremiumGuildSubscription');

    function sysMsgInjecton ([ maybeProps ], res) {
      if (_this.settings.get('systemMessages', true)) {
        const props = maybeProps || this.props;

        if (props.message.colorString) {
          const parts = res.props.children[1]?.type?.displayName === 'ChatLayer'
            ? res.props.children[0].props.children
            : res.props.children;

          parts.forEach(part => {
            if (typeof part !== 'string') {
              part.props.className = 'rolecolor-colored';
              part.props.style = { '--color': props.message.colorString };
            }
          });
        }
      }

      return res;
    }

    inject('rce-systemMessages-join', UserJoin, 'default', sysMsgInjecton);
    inject('rce-systemMessages-boost', UserPremiumGuildSubscription.prototype, 'render', sysMsgInjecton);

    UserJoin.default.displayName = 'UserJoin';
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
          className: 'rolecolor-colored',
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
