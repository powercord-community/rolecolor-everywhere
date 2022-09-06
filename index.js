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

    this.currentUser = await getModule([ 'getCurrentUser', 'getUser' ]);
    this.members = await getModule([ 'getMember' ]);
    this.channels = await getModule([ 'getChannel', 'getDMFromUserId' ]);
    this.guilds = await getModule([ 'getGuild' ]);
    this.currentGuild = await getModule([ 'getLastSelectedGuildId' ]);

    this.parser = await getModule([ 'parse', 'defaultRules' ], false);

    this._usernameComponent = Flux.connectStores([ this.currentGuild ], () => ({ guildId: this.currentGuild.getGuildId() }))(this._usernameComponent.bind(this));
    this.injectAccount();
    this.injectVoice();
    this.injectTyping();
    this.injectMemberList();
    this.injectMessages();
    this.injectUserMentions();
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

    if (this.originalMentionReactFn) {
      this.parser.defaultRules.mention.react = this.originalMentionReactFn;
    }

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

      const originalUsername = res.props.children[0].props.children.props.children;
      res.props.children[0].props.children.props.children = React.createElement(this._usernameComponent, null, originalUsername);
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
        if (member.colorString && res.props.children[0].props.children[1].props.children[i * 2].props) {
          res.props.children[0].props.children[1].props.children[i * 2].props.className = 'rolecolor-colored';
          res.props.children[0].props.children[1].props.children[i * 2].props.style = { '--color': member.colorString };
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
      if (!this.settings.get('members', true) || !res?.props?.children || !(/\d+/).test(args[0].id)) {
        return res;
      }

      const guild = this.guilds.getGuild(this.currentGuild.getGuildId());
      const role = guild.roles[args[0].id];
      if (role.color === 0) {
        return res;
      }

      res.props.children[1].props.className = 'rolecolor-colored';
      res.props.children[1].props.style = { '--color': this._numberToRgba(role.color) };

      return res;
    });
  }

  async injectMessages () {
    const MessageContent = await getModule(m => m.type?.displayName === 'MessageContent');
    inject('rce-messages', MessageContent, 'type', ([ props ], res) => {
      if (this.settings.get('messages', true)) {
        res.props.className += ' rolecolor-colored';
        res.props.style = { '--color': this._getRoleColor(props.message.channel_id, props.message.author.id) };
      }

      return res;
    });
    MessageContent.type.displayName = 'MessageContent';
  }

  async injectUserMentions () {
    const originalFn = this.parser.defaultRules.mention.react;
    this.originalMentionReactFn = originalFn;

    this.parser.defaultRules.mention.react = (node, output, state) => {
      let res = originalFn(node, output, state);
      if (!this.settings.get('mentions', true)) {
        return res;
      }

      const color = this._getRoleColor(node.channelId, node.userId);
      if (color) {
        const colorInt = parseInt(color.slice(1), 16);
        res.props.className += ' rolecolor-mention';
        res = React.createElement('span', { style: {
          '--color': color,
          '--hoveredColor': this._numberToTextColor(colorInt),
          '--backgroundColor': this._numberToRgba(colorInt, 0.1)
        } }, res);
      }

      return res;
    };
  }

  async injectSystemMessages () {
    const _this = this;
    const UserJoin = await getModule(m => m.default?.displayName === 'UserJoin');
    const UserPremiumGuildSubscription = await getModuleByDisplayName('UserPremiumGuildSubscription');

    function sysMsgInjecton ([ maybeProps ], res) {
      if (_this.settings.get('systemMessages', true)) {
        const props = maybeProps || this.props;

        const color = _this._getRoleColor(props.message.channel_id, props.message.author.id);
        if (color) {
          const parts = res.props.children[1]?.type?.displayName === 'ChatLayer'
            ? res.props.children[0].props.children
            : res.props.children;

          parts.forEach(part => {
            if (typeof part !== 'string') {
              part.props.className = 'rolecolor-colored';
              part.props.style = { '--color': color };
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
    await inject('rce-slateMentions', module, 'UserMention', ([ { id, guildId } ], res) => {
      if (!this.settings.get('mentions', true)) {
        return res;
      }
      const ogChildren = res.props.children;
      res.props.children = (props) => {
        const res = ogChildren(props);
        const member = this.members.getMember(guildId, id);
        if (member && member.colorString) {
          const colorInt = parseInt(member.colorString.slice(1), 16);
          res.props.className += ' rolecolor-mention';
          res.props.style = {
            '--color': member.colorString,
            '--hoveredColor': this._numberToTextColor(colorInt),
            '--backgroundColor': this._numberToRgba(colorInt, 0.1)
          };
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

  // todo: fix
  async injectUserPopout () {
    const _this = this;
    const UserPopout = await this._extractUserPopout();

    inject('rce-user-popout', UserPopout.prototype, 'renderHeader', function (_, res) {
      if (!_this.settings.get('userPopouts', true) || !this.props.guildMember?.colorString) {
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

  _getRoleColor (channelId, userId) {
    const channel = this.channels.getChannel(channelId);
    if (!channel) {
      return null;
    }

    const member = this.members.getMember(channel.guild_id, userId);
    if (!member) {
      return null;
    }
    return member.colorString;
  }

  _usernameComponent ({ guildId, children }) {
    if (!guildId) {
      return children;
    }

    const currentId = this.currentUser.getCurrentUser().id;
    const member = this.members.getMember(guildId, currentId);
    if (member && member.colorString) {
      return React.createElement('span', {
        className: 'rolecolor-colored',
        style: { '--color': member.colorString }
      }, children);
    }
    return children;
  }

  async _extractUserPopout () {
    const userStore = await getModule([ 'getCurrentUser', 'getUser' ]);
    const functionalUserPopout = await getModule((m) => m.type?.displayName === 'UserPopoutContainer');

    // React Honks moment
    const owo = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current;
    const ogUseMemo = owo.useMemo;
    const ogUseState = owo.useState;
    const ogUseEffect = owo.useEffect;
    const ogUseLayoutEffect = owo.useLayoutEffect;
    const ogUseRef = owo.useRef;
    const ogUseCallback = owo.useCallback;

    owo.useMemo = (x) => x();
    owo.useState = (x) => [ x, () => void 0 ];
    owo.useEffect = () => null;
    owo.useLayoutEffect = () => null;
    owo.useRef = () => ({});
    owo.useCallback = (c) => c;

    // Render moment
    const ogGetCurrentUser = userStore.getCurrentUser;
    // userStore.getCurrentUser = () => ({ id: '0' })
    let res;
    try {
      res = functionalUserPopout.type({ user: { isNonUserBot: () => void 0 } });
    } finally {
      userStore.getCurrentUser = ogGetCurrentUser;
    }

    // React Hooks moment
    owo.useMemo = ogUseMemo;
    owo.useState = ogUseState;
    owo.useEffect = ogUseEffect;
    owo.useLayoutEffect = ogUseLayoutEffect;
    owo.useRef = ogUseRef;
    owo.useCallback = ogUseCallback;

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
