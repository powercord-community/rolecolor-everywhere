/*
 * Copyright (c) 2020 Bowser65
 * Licensed under the Open Software License version 3.0
 */

const { React, i18n: { Messages } } = require('powercord/webpack');
const { SwitchItem } = require('powercord/components/settings');

module.exports = class Settings extends React.PureComponent {
  render () {
    return (
      <div>
        <SwitchItem
          note='Whether your username is colored within the account box indicator'
          value={this.props.getSetting('account', true)}
          onChange={() => this.props.toggleSetting('account', true)}
        >
          {Messages.ACCOUNT}
        </SwitchItem>
        <SwitchItem
          note='Whether usernames in voice channels are colored'
          value={this.props.getSetting('voice', true)}
          onChange={() => this.props.toggleSetting('voice', true)}
        >
          Voice users
        </SwitchItem>
        <SwitchItem
          note='Whether mentions in chat are colored'
          value={this.props.getSetting('mentions', true)}
          onChange={() => this.props.toggleSetting('mentions', true)}
        >
          {Messages.FORM_LABEL_MENTIONS}
        </SwitchItem>
        <SwitchItem
          note='Whether typing indicators are colored'
          value={this.props.getSetting('typing', true)}
          onChange={() => this.props.toggleSetting('typing', true)}
        >
          Typing indicator
        </SwitchItem>
        <SwitchItem
          note='Whether role names in the member list are colored'
          value={this.props.getSetting('members', true)}
          onChange={() => this.props.toggleSetting('members', true)}
        >
          Members List
        </SwitchItem>
        <SwitchItem
          note='Whether user statuses in the member list are colored'
          value={this.props.getSetting('status', true)}
          onChange={() => this.props.toggleSetting('status', true)}
        >
          Members List Status
        </SwitchItem>
        <SwitchItem
          note='Whether messages are colored'
          value={this.props.getSetting('messages', true)}
          onChange={() => this.props.toggleSetting('messages', true)}
        >
          {Messages.MESSAGES}
        </SwitchItem>
        <SwitchItem
          note='Whether system messages are colored'
          value={this.props.getSetting('systemMessages', true)}
          onChange={() => this.props.toggleSetting('systemMessages', true)}
        >
          System messages
        </SwitchItem>
        <SwitchItem
          note='Whether usernames in user popouts are colored'
          value={this.props.getSetting('userPopouts', true)}
          onChange={() => this.props.toggleSetting('userPopouts', true)}
        >
          User popouts
        </SwitchItem>
      </div>
    );
  }
};
