const { waitFor, getOwnerInstance } = require('powercord/util');
const { React, getModule } = require('powercord/webpack');
const { inject, uninject } = require('powercord/injector');
const { Plugin } = require('powercord/entities');

const Settings = require('./Settings');

module.exports = class RoleColorEverywhere extends Plugin {
  async startPlugin () {
    this.registerSettings('rceverywhere', 'Role Color Everywhere', Settings);

    this.currentUser = (await getModule([ 'getCurrentUser' ])).getCurrentUser().id;
    this.members = await getModule([ 'getMember' ]);
    this.guilds = await getModule([ 'getGuild' ]);
    this.injectTyping();
    this.injectMemberList();
  }

  pluginWillUnload () {
    uninject('rce-typing');
    uninject('rce-members');
  }

  async injectTyping () {
    const _this = this;
    const typing = await getModule([ 'typing', 'activityInviteEducation' ]);
    const instance = getOwnerInstance(await waitFor(`.${typing.typing.replace(/ /g, '.')}`));
    inject('rce-typing', instance.__proto__, 'render', function (args, res) {
      if (!res || !this.props.channel.guild_id || !_this.settings.get('typing', true)) {
        return res;
      }

      Object.keys(this.props.typingUsers).filter(id => id !== _this.currentUser).forEach((id, i) => {
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

        const r = (role.color & 0xFF0000) >>> 16;
        const g = (role.color & 0xFF00) >>> 8;
        const b = role.color & 0xFF;
        return React.createElement('div', {
          className: members.membersGroup,
          style: {
            color: `rgb(${r}, ${g}, ${b})`
          }
        }, `${section.props.title}—${section.props.count}`);
      };
      return res;
    });
    instance.forceUpdate();
  }
};
