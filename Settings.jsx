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
          note='Should your username in account box indicator be colored'
          value={this.props.getSetting('account', true)}
          onChange={() => this.props.toggleSetting('account', true)}
        >
          {Messages.ACCOUNT}
        </SwitchItem>
        <SwitchItem
          note='Whether hould usernames in voice channels be colored or not'
          value={this.props.getSetting('voice', true)}
          onChange={() => this.props.toggleSetting('voice', true)}
        >
          Voice users
        </SwitchItem>
        <SwitchItem
          note='Whether hould mentions in chat be colored or not'
          value={this.props.getSetting('mentions', true)}
          onChange={() => this.props.toggleSetting('mentions', true)}
        >
          {Messages.FORM_LABEL_MENTIONS}
        </SwitchItem>
        <SwitchItem
          note='Whether hould typing indicator be colored or not'
          value={this.props.getSetting('typing', true)}
          onChange={() => this.props.toggleSetting('typing', true)}
        >
          Typing indicator
        </SwitchItem>
        <SwitchItem
          note='Whether hould role names in member list be colored or not'
          value={this.props.getSetting('members', true)}
          onChange={() => this.props.toggleSetting('members', true)}
        >
          Members list
        </SwitchItem>
        <SwitchItem
          note='Whether hould user statuses in member list be colored or not'
          value={this.props.getSetting('status', true)}
          onChange={() => this.props.toggleSetting('status', true)}
        >
          {Messages.FRIENDS_COLUMN_STATUS}
        </SwitchItem>
        <SwitchItem
          note='Whether hould messages be colored or not'
          value={this.props.getSetting('messages', true)}
          onChange={() => this.props.toggleSetting('messages', true)}
        >
          {Messages.MESSAGES}
        </SwitchItem>
        <SwitchItem
          note='Whether hould system messages be colored. or not'
          value={this.props.getSetting('systemMessages', true)}
          onChange={() => this.props.toggleSetting('systemMessages', true)}
        >
          System messages
        </SwitchItem>
        <SwitchItem
          note='Whether hould names in user popouts be colored. or not'
          value={this.props.getSetting('userPopouts', true)}
          onChange={() => this.props.toggleSetting('userPopouts', true)}
        >
          User popouts
        </SwitchItem>
      </div>
    );
  }
};
