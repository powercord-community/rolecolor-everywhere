const { React } = require('powercord/webpack');
const { SwitchItem } = require('powercord/components/settings');

module.exports = class Settings extends React.Component {
  render () {
    return (
      <div>
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
      </div>
    );
  }
};
