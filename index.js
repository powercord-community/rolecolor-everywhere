/*
 * Copyright (c) 2020 Bowser65
 * Licensed under the Open Software License version 3.0
 */

const { React, Flux, getModule, getModuleByDisplayName } = require('powercord/webpack');
const { waitFor, getOwnerInstance, findInReactTree } = require('powercord/util');
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
    this.injectUserPopout();
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
    uninject('rce-user-popout');
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
    const members = await getModule([ 'members', 'membersWrap' ]);
    const instance = getOwnerInstance(await waitFor(`.${members.membersGroup}`));
    inject('rce-members', instance.props.children.type, 'type', (args, res) => {
      if (!this.settings.get('members', true) || !res?.props?.children?.props || !(/\d+/).test(args[0].id)) {
        return res;
      }

      const guild = this.guilds.getGuild(this.currentGuild.getGuildId());
      const role = guild.roles[args[0].id];
      if (role.color === 0) {
        return res;
      }

      res.props.children.props.className = 'rolecolor-colored';
      res.props.children.props.style = { '--color': this._numberToRgba(role.color) };

      return res;
    });
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
        const channel = this.channels.getChannel(props.message.channel_id);
        if (channel) {
          const guildId = this.channels.getChannel(props.message.channel_id).guild_id;
          const colors = (props.message.content.match(/<@!?(\d+)>/g) || [])
            .map(m => this.members.getMember(guildId, m.replace(/[<@!>]/g, ''))?.colorString);

          this._transformMessage(colors, res.props.children[0]);
        }
      }
      return res;
    });
    MessageContent.type.displayName = 'MessageContent';
  }

  _transformMessage (colors, items) {
    for (const item of items) {
      if (typeof item === 'string') {
        continue;
      }

      if (Array.isArray(item.props.children)) {
        this._transformMessage(colors, item.props.children);
      }

      if (item.props?.children?.type?.displayName === 'Mention' || item.type?.displayName === 'Mention') {
        const color = colors.shift();
        if (color) {
          const mention = item.props.className ? item : item.props.children;
          const colorInt = parseInt(color.slice(1), 16);
          mention.props.className += ' rolecolor-mention';
          mention.props.children = React.createElement('span', {
            style: {
              '--color': color,
              '--hoveredColor': this._numberToTextColor(colorInt),
              '--backgroundColor': this._numberToRgba(colorInt, 0.1)
            }
          }, mention.props.children);
        }
      }
    }
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
          res.props.className += ' rolecolor-mention';
          res.props.children = React.createElement('span', {
            style: {
              '--color': member.colorString,
              '--hoveredColor': this._numberToTextColor(colorInt),
              '--backgroundColor': this._numberToRgba(colorInt, 0.1)
            }
          }, res.props.children);
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
    await inject('rce-status', MemberListItem.prototype, 'renderActivity', function (_, res) {
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

  async injectUserPopout () {
    const _this = this;
    const UserPopout = await this._extractUserPopout();

    inject('rce-user-popout', UserPopout.prototype, 'renderHeader', function (_, res) {
      if (!_this.settings.get('userPoputs', true) || !this.props.guildMember?.colorString) {
        return res;
      }

      const color = this.props.guildMember.colorString;
      const usernameAndNick = findInReactTree(res, p => Array.isArray(p) && p[1]?.type?.displayName === 'Flex');
      if (usernameAndNick[0]) {
        // Inject in the nickname only
        usernameAndNick[0].props.children.props.className += ' rolecolor-colored-userpopout';
        usernameAndNick[0].props.children.props.style = { '--color': color };
      } else {
        // Inject in the DiscordTag
        const tag = findInReactTree(res, p => p.type?.displayName === 'DiscordTag');
        const ogTagType = tag.type;
        tag.type = function (props) {
          const name = ogTagType.call(this, props);
          const ogNameType = name.type;
          name.type = function (props) {
            const res = ogNameType.call(this, props);
            const target = res.props.className.includes('headerTagWithNickname')
              ? res.props.children[0]
              : res;

            target.props.className += ' rolecolor-colored-userpopout';
            if (!target.props.style) { // Seems like it can be defined in some cases? idk
              target.props.style = {};
            }
            target.props.style['--color'] = color;
            return res;
          };
          return name;
        };
      }
      return res;
    });
  }

  async _extractUserPopout () {
    const functionalUserPopout = await getModuleByDisplayName('UserPopout');

    // React Honks moment
    const owo = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current;
    const ogUseMemo = owo.useMemo;
    const ogUseState = owo.useState;
    const ogUseEffect = owo.useEffect;
    const ogUseLayoutEffect = owo.useLayoutEffect;
    const ogUseRef = owo.useRef;

    owo.useMemo = () => null;
    owo.useState = () => [ null, () => void 0 ];
    owo.useEffect = () => null;
    owo.useLayoutEffect = () => null;
    owo.useRef = () => ({});

    // Render moment
    const res = functionalUserPopout({ user: { isNonUserBot: () => void 0 } });

    // React Hooks moment
    owo.useMemo = ogUseMemo;
    owo.useState = ogUseState;
    owo.useEffect = ogUseEffect;
    owo.useLayoutEffect = ogUseLayoutEffect;
    owo.useRef = ogUseRef;

    // Poggers moment
    return res.type;
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
