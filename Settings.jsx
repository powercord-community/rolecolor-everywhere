const { React } = require('powercord/webpack');
const { SwitchItem } = require('powercord/components/settings');

module.exports = class Settings extends React.Component {
  render () {
    return (
      <div>
        <SwitchItem
          note='Should your username in account box indicator be colored'
          value={this.props.getSetting('account', true)}
          onChange={() => this.props.toggleSetting('account')}
        >
          Account
        </SwitchItem>
        <SwitchItem
          note='Should usernames in voice channels be colored'
          value={this.props.getSetting('voice', true)}
          onChange={() => this.props.toggleSetting('voice')}
        >
          Voice users
        </SwitchItem>
        <SwitchItem
          note='Should mentions in chat be colored'
          value={this.props.getSetting('mentions', true)}
          onChange={() => this.props.toggleSetting('mentions')}
        >
          Mentions
        </SwitchItem>
        <SwitchItem
          note='Should typing indicator be colored'
          value={this.props.getSetting('typing', true)}
          onChange={() => this.props.toggleSetting('typing')}
        >
          Typing indicator
        </SwitchItem>
        <SwitchItem
          note='Should role names in member list be colored'
          value={this.props.getSetting('members', true)}
          onChange={() => this.props.toggleSetting('members')}
        >
          Members list
        </SwitchItem>
        <SwitchItem
          note='Should user statuses in member list be colored'
          value={this.props.getSetting('status', true)}
          onChange={() => this.props.toggleSetting('status')}
        >
          Status
        </SwitchItem>
        <SwitchItem
          note='Should messages be colored'
          value={this.props.getSetting('messages', true)}
          onChange={() => this.props.toggleSetting('messages')}
        >
          Messages
        </SwitchItem>
      </div>
    );
  }
};
