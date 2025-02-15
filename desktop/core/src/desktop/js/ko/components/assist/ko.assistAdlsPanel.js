// Licensed to Cloudera, Inc. under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  Cloudera, Inc. licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import ko from 'knockout';

import apiHelper from 'api/apiHelper';
import AssistStorageEntry from 'ko/components/assist/assistStorageEntry';
import componentUtils from 'ko/components/componentUtils';
import huePubSub from 'utils/huePubSub';
import HDFS_CONTEXT_ITEMS_TEMPLATE from 'ko/components/assist/ko.assistHdfsPanel';
import I18n from 'utils/i18n';

const TEMPLATE =
  HDFS_CONTEXT_ITEMS_TEMPLATE +
  `
  <script type="text/html" id="assist-adls-header-actions">
    <div class="assist-db-header-actions">
      <a class="inactive-action" href="javascript:void(0)" data-bind="click: goHome, attr: { title: I18n('Go to ' + window.USER_HOME_DIR) }"><i class="pointer fa fa-home"></i></a>
      <!-- ko if: window.SHOW_UPLOAD_BUTTON -->
      <a class="inactive-action" data-bind="dropzone: {
            url: '/filebrowser/upload/file?dest=adl:' + path,
            params: { dest: path },
            paramName: 'hdfs_file',
            onError: function(x, e){ $(document).trigger('error', e); },
            onComplete: function () { huePubSub.publish('assist.adls.refresh'); } }" title="${I18n(
              'Upload file'
            )}" href="javascript:void(0)">
        <div class="dz-message inline" data-dz-message><i class="pointer fa fa-plus" title="${I18n(
          'Upload file'
        )}"></i></div>
      </a>
      <!-- /ko -->
      <a class="inactive-action" href="javascript:void(0)" data-bind="click: function () { huePubSub.publish('assist.adls.refresh'); }" title="${I18n(
        'Manual refresh'
      )}"><i class="pointer fa fa-refresh" data-bind="css: { 'fa-spin blue' : loading }"></i></a>
    </div>
  </script>
  
  <!-- ko hueSpinner: { spin: loading, center: true, size: 'large' } --><!-- /ko -->
  <!-- ko with: selectedAdlsEntry -->
  <div class="assist-flex-header assist-breadcrumb" >
    <!-- ko if: parent !== null -->
    <a href="javascript: void(0);" data-bind="appAwareTemplateContextMenu: { template: 'hdfs-context-items', scrollContainer: '.assist-adls-scrollable' }, click: function () { huePubSub.publish('assist.selectAdlsEntry', parent); }">
      <i class="fa fa-fw fa-chevron-left"></i>
      <i class="fa fa-fw fa-folder-o"></i>
      <span data-bind="text: definition.name, tooltip: {'title': path, 'placement': 'top' }"></span>
    </a>
    <!-- /ko -->
    <!-- ko if: parent === null -->
    <div>
      <i class="fa fa-fw fa-folder-o"></i>
      <span data-bind="text: path"></span>
    </div>
    <!-- /ko -->
    <!-- ko template: 'assist-adls-header-actions' --><!-- /ko -->
  </div>
  <div class="assist-flex-search">
    <div class="assist-filter"><input class="clearable" type="text" placeholder="${I18n(
      'Filter...'
    )}" data-bind="clearable: filter, value: filter, valueUpdate: 'afterkeydown'"/></div>
  </div>
  <div class="assist-flex-fill assist-adls-scrollable" data-bind="delayedOverflow">
    <div data-bind="visible: ! loading() && ! hasErrors()" style="position: relative;">
      <!-- ko hueSpinner: { spin: loadingMore, overlay: true } --><!-- /ko -->
      <ul class="assist-tables" data-bind="foreachVisible: { data: entries, minHeight: 22, container: '.assist-adls-scrollable', fetchMore: $data.fetchMore.bind($data) }">
        <li class="assist-entry assist-table-link" style="position: relative;" data-bind="appAwareTemplateContextMenu: { template: 'hdfs-context-items', scrollContainer: '.assist-adls-scrollable' }, visibleOnHover: { override: contextPopoverVisible, 'selector': '.assist-actions' }">
          <div class="assist-actions table-actions" style="opacity: 0;" >
            <a style="padding: 0 3px;" class="inactive-action" href="javascript:void(0);" data-bind="click: showContextPopover, css: { 'blue': contextPopoverVisible }">
              <i class='fa fa-info' title="${I18n('Details')}"></i>
            </a>
          </div>

          <a href="javascript:void(0)" class="assist-entry assist-table-link" data-bind="multiClick: { click: toggleOpen, dblClick: dblClick }, attr: {'title': definition.name }">
            <!-- ko if: definition.type === 'dir' -->
            <i class="fa fa-fw fa-folder-o muted valign-middle"></i>
            <!-- /ko -->
            <!-- ko if: definition.type === 'file' -->
            <i class="fa fa-fw fa-file-o muted valign-middle"></i>
            <!-- /ko -->
            <span draggable="true" data-bind="text: definition.name, draggableText: { text: '\\'' + path + '\\'', meta: {'type': 'adls', 'definition': definition} }"></span>
          </a>
        </li>
      </ul>
      <!-- ko if: !loading() && entries().length === 0 -->
      <ul class="assist-tables">
        <li class="assist-entry"><span class="assist-no-entries"><!-- ko if: filter() -->${I18n(
          'No results found.'
        )}<!-- /ko --><!-- ko ifnot: filter() -->${I18n('Empty directory')}<!-- /ko --></span></li>
      </ul>
      <!-- /ko -->
    </div>
    <!-- ko hueSpinner: { spin: loading, center: true, size: 'large' } --><!-- /ko -->
    <div class="assist-errors" data-bind="visible: ! loading() && hasErrors()">
      <span>${I18n('Error loading contents.')}</span>
    </div>
  </div>
  <!-- /ko -->
`;

class AssistAdlsPanel {
  constructor() {
    const self = this;
    self.selectedAdlsEntry = ko.observable();
    self.loading = ko.observable();
    self.initialized = false;

    const loadPath = path => {
      self.loading(true);
      const parts = path.split('/');
      parts.shift();

      const currentEntry = new AssistStorageEntry({
        type: 'adls',
        definition: {
          name: '/',
          type: 'dir'
        },
        parent: null
      });

      currentEntry.loadDeep(parts, entry => {
        self.selectedAdlsEntry(entry);
        entry.open(true);
        self.loading(false);
      });
    };

    self.reload = () => {
      loadPath(apiHelper.getFromTotalStorage('assist', 'currentAdlsPath', '/'));
    };

    huePubSub.subscribe('assist.adls.go.home', () => {
      loadPath(window.USER_HOME_DIR);
      apiHelper.setInTotalStorage('assist', 'currentAdlsPath', window.USER_HOME_DIR);
    });

    huePubSub.subscribe('assist.selectAdlsEntry', entry => {
      self.selectedAdlsEntry(entry);
      apiHelper.setInTotalStorage('assist', 'currentAdlsPath', entry.path);
    });

    huePubSub.subscribe('assist.adls.refresh', () => {
      huePubSub.publish('assist.clear.adls.cache');
      self.reload();
    });

    self.init();
  }

  init() {
    const self = this;
    if (self.initialized) {
      return;
    }
    self.reload();
    self.initialized = true;
  }
}

componentUtils.registerStaticComponent('hue-assist-adls-panel', AssistAdlsPanel, TEMPLATE);
