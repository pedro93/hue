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

import $ from 'jquery';
import ko from 'knockout';

import AssistDbSource from 'ko/components/assist/assistDbSource';
import AssistDbEntry from 'ko/components/assist/assistDbEntry';
import componentUtils from 'ko/components/componentUtils';
import huePubSub from 'utils/huePubSub';
import dataCatalog from 'catalog/dataCatalog';
import I18n from 'utils/i18n';

const TEMPLATE = `
  <div class="assist-inner-panel assist-assistant-panel">
    <div class="assist-flex-panel">

      <div class="assist-flex-header">
        <div class="assist-inner-header">
          <!-- ko if: isSolr -->
          ${I18n('Indexes')}
          <!-- /ko -->
          <!-- ko ifnot: isSolr -->
          ${I18n('Tables')}
          <!-- ko if: statementCount() > 1 -->
          <div class="statement-count">${I18n(
            'Statement'
          )} <span data-bind="text: activeStatementIndex() + '/' + statementCount()"></span></div>
          <!-- /ko -->
          <!-- /ko -->
        </div>
      </div>
      <div class="assist-flex-search" data-bind="visible: activeTables().length > 0">
        <div class="assist-filter">
          <!-- ko component: {
            name: 'inline-autocomplete',
            params: {
              querySpec: filter.querySpec,
              facets: ['type'],
              knownFacetValues: isSolr() ? SOLR_ASSIST_KNOWN_FACET_VALUES : SQL_ASSIST_KNOWN_FACET_VALUES,
              autocompleteFromEntries: $component.autocompleteFromEntries
            }
          } --><!-- /ko -->
        </div>
      </div>
      <div class="assist-flex-fill assist-db-scrollable" data-bind="delayedOverflow">
        <!-- ko if: filteredTables().length === 0 && (!filter.querySpec() || filter.querySpec().query === '') -->
        <div class="assist-no-entries">
          <!-- ko if: isSolr -->
          ${I18n('No indexes selected.')}
          <!-- /ko -->
          <!-- ko ifnot: isSolr  -->
          ${I18n('No tables identified.')}
          <!-- /ko -->
        </div>
        <!-- /ko -->
        <!-- ko if: filteredTables().length === 0 && filter.querySpec() && filter.querySpec().query !== '' && !someLoading() -->
        <div class="assist-no-entries">${I18n('No entries found')}</div>
        <!-- /ko -->
        <!-- ko if: filteredTables().length > 0 -->
        <ul class="database-tree assist-tables" data-bind="foreachVisible: { data: filteredTables, minHeight: 22, container: '.assist-db-scrollable', skipScrollEvent: true }">
          <!-- ko if: hasErrors -->
          <li class="assist-table hue-warning" data-bind="attr: { 'title': $parent.isSolr() ? '${I18n(
            'Error loading index details.'
          )}' : '${I18n('Error loading table details.')}'}">
            <span class="assist-entry">
              <i class="hue-warning fa fa-fw muted valign-middle fa-warning"></i>
              <!-- ko with: catalogEntry -->
              <!-- ko if: typeof reload !== 'undefined' -->
              <span data-bind="text: getDisplayName()"></span> <a class="inactive-action" href="javascript: void(0);" data-bind="click: reload"><i class="fa fa-refresh" data-bind="css: { 'fa-spin': reloading }"></i></a>
              <!-- /ko -->
              <!-- /ko -->
            </span>
          </li>
          <!-- /ko -->
          <!-- ko ifnot: hasErrors -->
          <!-- ko template: { if: catalogEntry.isTableOrView(), name: 'assist-table-entry' } --><!-- /ko -->
          <!-- ko template: { if: catalogEntry.isField(), name: 'assist-column-entry-assistant' } --><!-- /ko -->
          <!-- /ko -->
        </ul>
        <!-- /ko -->
        <!-- ko hueSpinner: { spin: filter.querySpec() && filter.querySpec().query !== '' && someLoading(), inline: true,  center: true} --><!-- /ko -->
      </div>

      <!-- ko if: showRisks -->
      <div class="assist-flex-header assist-divider"><div class="assist-inner-header">${I18n(
        'Query Analysis'
      )}</div></div>
      <div class="assist-flex-third">
        <!-- ko if: ! activeRisks().hints -->
        <div class="assist-no-entries">${I18n(
          'Select a query or start typing to get optimization hints.'
        )}</div>
        <!-- /ko -->
        <!-- ko if: activeRisks().hints && activeRisks().hints.length === 0 -->
        <div class="assist-no-entries">${I18n('No optimizations identified.')}</div>
        <!-- /ko -->
        <!-- ko if: activeRisks().hints && activeRisks().hints.length > 0 -->
        <ul class="risk-list" data-bind="foreach: activeRisks().hints">
          <li>
            <div class="risk-list-title" data-bind="css: { 'risk-list-high' : risk === 'high', 'risk-list-normal':  risk !== 'high' }, tooltip: { title: risk + ' ' + riskTables }"><span data-bind="text: riskAnalysis"></span></div>
            <div class="risk-list-description" data-bind="text: riskRecommendation"></div>
            <div class="risk-quickfix" data-bind="visible: (riskId === 17 || riskId === 22) && $parent.activeEditor() && $parent.activeLocations()" style="display:none;">
              <a href="javascript:void(0);" data-bind="click: function () { $parent.addFilter(riskId); hueAnalytics.convert('optimizer', 'addFilter/' + riskId); }">${I18n(
                'Add filter'
              )}</a>
            </div>
          </li>
        </ul>
        <!-- /ko -->
        <!-- ko if: hasMissingRisks() -->
        <div class="margin-top-20">
          <!-- ko hueSpinner: { spin: uploadingTableStats, inline: true} --><!-- /ko -->
          <!-- ko ifnot: uploadingTableStats -->
          <a href="javascript:void(0)" data-bind="visible: activeTables().length > 0, click: function() { uploadTableStats(true) }, attr: { 'title': ('${I18n(
            'Add table '
          )}'  + (isMissingDDL() ? 'DDL' : '') + (isMissingDDL() && isMissingStats() ? ' ${I18n(
  'and'
)} ' : '') + (isMissingStats() ? 'stats' : '')) }">
            <i class="fa fa-fw fa-plus-circle"></i> ${I18n('Improve Analysis')}
          </a>
          <!-- /ko -->
        </div>
        <!-- /ko -->
      </div>
      <!-- /ko -->
    </div>
  </div>
`;

class AssistantUtils {
  static getFilteredTablesPureComputed(vm) {
    const openedByFilter = [];
    return ko.pureComputed(() => {
      if (
        !vm.filter ||
        !vm.filter.querySpec() ||
        ((!vm.filter.querySpec().facets ||
          Object.keys(vm.filter.querySpec().facets).length === 0) &&
          (!vm.filter.querySpec().text || vm.filter.querySpec().text.length === 0))
      ) {
        while (openedByFilter.length) {
          openedByFilter.pop().open(false);
        }
        return vm.activeTables();
      }

      const facets = vm.filter.querySpec().facets;

      const result = [];
      vm.activeTables().forEach(entry => {
        let facetMatch =
          !facets || !facets['type'] || (!facets['type']['table'] && !facets['type']['view']);
        if (!facetMatch && facets['type']['table']) {
          facetMatch = entry.catalogEntry.isTable();
        }
        if (!facetMatch && facets['type']['view']) {
          facetMatch = entry.catalogEntry.isView();
        }

        let textMatch = !vm.filter.querySpec().text || vm.filter.querySpec().text.length === 0;
        if (!textMatch) {
          const nameLower = entry.catalogEntry.name.toLowerCase();
          textMatch = vm.filter
            .querySpec()
            .text.every(text => nameLower.indexOf(text.toLowerCase()) !== -1);
        }
        entry.filterColumnNames(!textMatch);
        if ((facetMatch && textMatch) || entry.filteredEntries().length > 0) {
          if (!entry.open()) {
            entry.open(true);
            openedByFilter.push(entry);
          }
          result.push(entry);
        }
      });
      return result;
    });
  }
}

class AssistEditorContextPanel {
  constructor(params) {
    this.disposals = [];
    this.isSolr = ko.observable(false);
    this.activeTab = params.activeTab;

    this.sourceType = ko.observable(params.sourceType());

    this.showRisks = ko.pureComputed(
      () =>
        window.HAS_OPTIMIZER &&
        !this.isSolr() &&
        (this.sourceType() === 'impala' || this.sourceType() === 'hive')
    );

    const typeSub = huePubSub.subscribe('active.snippet.type.changed', details => {
      this.sourceType(details.type);
    });

    this.disposals.push(() => {
      typeSub.remove();
    });

    this.uploadingTableStats = ko.observable(false);
    this.activeStatement = ko.observable();
    this.activeTables = ko.observableArray();
    this.activeRisks = ko.observable({});
    this.activeEditor = ko.observable();
    this.activeRisks.subscribe(() => {
      if (this.isMissingDDL()) {
        this.uploadTableStats(false);
      }
    });
    this.activeLocations = ko.observable();
    this.statementCount = ko.observable(0);
    this.activeStatementIndex = ko.observable(0);

    this.hasActiveRisks = ko.pureComputed(
      () => this.activeRisks().hints && this.activeRisks().hints.length > 0
    );

    this.hasMissingRisks = ko.pureComputed(() => this.isMissingDDL() || this.isMissingStats());

    this.isMissingDDL = ko.pureComputed(
      () => this.activeRisks().noDDL && this.activeRisks().noDDL.length > 0
    );

    this.isMissingStats = ko.pureComputed(
      () =>
        window.AUTO_UPLOAD_OPTIMIZER_STATS &&
        this.activeRisks().noStats &&
        this.activeRisks().noStats.length > 0
    );

    this.someLoading = ko.pureComputed(() =>
      this.activeTables().some(
        table => table.loading() || (!table.hasEntries() && !table.hasErrors())
      )
    );

    const createQualifiedIdentifier = (identifierChain, defaultDatabase) => {
      if (identifierChain.length === 1) {
        return defaultDatabase + '.' + identifierChain[0].name;
      }
      return identifierChain
        .map(identifier => identifier.name)
        .join('.')
        .toLowerCase();
    };

    this.filter = {
      querySpec: ko
        .observable({
          query: '',
          facets: {},
          text: []
        })
        .extend({ rateLimit: 300 })
    };

    this.filteredTables = AssistantUtils.getFilteredTablesPureComputed(this);

    const navigationSettings = {
      showStats: true,
      rightAssist: true
    };
    const i18n = {};

    const sources = {};

    let loadEntriesTimeout = -1;
    // This fetches the columns for each table synchronously with 2 second in between.
    const loadEntries = currentCount => {
      let count = currentCount || 0;
      count++;
      if (count > 10) {
        return;
      }
      window.clearTimeout(loadEntriesTimeout);
      if (this.activeTables().length === 1) {
        this.activeTables()[0].open(true);
      } else {
        loadEntriesTimeout = window.setTimeout(() => {
          this.activeTables().every(table => {
            if (!table.loaded && !table.hasErrors() && !table.loading()) {
              table.loadEntries(() => {
                loadEntries(count);
              });
              return false;
            }
            return !table.loading();
          });
        }, 2000);
      }
    };

    this.autocompleteFromEntries = (nonPartial, partial) => {
      const added = {};
      const result = [];
      const partialLower = partial.toLowerCase();
      this.filteredTables().forEach(table => {
        if (
          !added[table.catalogEntry.name] &&
          table.catalogEntry.name.toLowerCase().indexOf(partialLower) === 0
        ) {
          added[table.catalogEntry.name] = true;
          result.push(nonPartial + partial + table.catalogEntry.name.substring(partial.length));
        }
        table.entries().forEach(col => {
          if (
            !added[col.catalogEntry.name] &&
            col.catalogEntry.name.toLowerCase().indexOf(partialLower) === 0
          ) {
            added[col.catalogEntry.name] = true;
            result.push(nonPartial + partial + col.catalogEntry.name.substring(partial.length));
          }
        });
      });
      return result;
    };

    const activeTablesSub = this.activeTables.subscribe(loadEntries);
    this.disposals.push(() => {
      window.clearTimeout(loadEntriesTimeout);
      activeTablesSub.dispose();
    });

    let updateOnVisible = false;

    const runningPromises = [];

    const handleLocationUpdate = activeLocations => {
      while (runningPromises.length) {
        const promise = runningPromises.pop();
        if (promise.cancel) {
          promise.cancel();
        }
      }
      updateOnVisible = false;

      if (!sources[activeLocations.type]) {
        sources[activeLocations.type] = {
          assistDbSource: new AssistDbSource({
            i18n: i18n,
            initialNamespace: activeLocations.namespace,
            type: activeLocations.type,
            name: activeLocations.type,
            navigationSettings: navigationSettings
          }),
          databaseIndex: {},
          activeTableIndex: {}
        };
      }

      const assistDbSource = sources[activeLocations.type].assistDbSource;
      const databaseIndex = sources[activeLocations.type].databaseIndex;
      const activeTableIndex = sources[activeLocations.type].activeTableIndex;

      if (!activeLocations) {
        this.activeLocations(undefined);
        return;
      }
      this.activeLocations(activeLocations);
      this.statementCount(activeLocations.totalStatementCount);
      this.activeStatementIndex(activeLocations.activeStatementIndex);

      if (activeLocations.activeStatementLocations) {
        let updateTables = false;
        const tableQidIndex = {};
        const ctes = {};
        activeLocations.activeStatementLocations.forEach(location => {
          if (location.type === 'alias' && location.source === 'cte') {
            ctes[location.alias.toLowerCase()] = true;
          }
        });

        activeLocations.activeStatementLocations.forEach(location => {
          if (
            location.type === 'table' &&
            (location.identifierChain.length !== 1 ||
              !ctes[location.identifierChain[0].name.toLowerCase()])
          ) {
            const tableDeferred = $.Deferred();
            const dbDeferred = $.Deferred();
            runningPromises.push(tableDeferred);
            runningPromises.push(dbDeferred);

            const qid = createQualifiedIdentifier(
              location.identifierChain,
              activeLocations.defaultDatabase
            );
            if (activeTableIndex[qid]) {
              tableQidIndex[qid] = true;
              tableDeferred.resolve(activeTableIndex[qid]);
              dbDeferred.resolve(activeTableIndex[qid].parent);
            } else {
              let database =
                location.identifierChain.length === 2
                  ? location.identifierChain[0].name
                  : activeLocations.defaultDatabase;
              database = database.toLowerCase();
              if (databaseIndex[database]) {
                dbDeferred.resolve(databaseIndex[database]);
              } else {
                dataCatalog
                  .getEntry({
                    sourceType: activeLocations.type,
                    namespace: activeLocations.namespace,
                    compute: activeLocations.compute,
                    path: [database],
                    definition: { type: 'database' }
                  })
                  .done(catalogEntry => {
                    databaseIndex[database] = new AssistDbEntry(
                      catalogEntry,
                      null,
                      assistDbSource,
                      this.filter,
                      i18n,
                      navigationSettings
                    );
                    updateTables = true;
                    dbDeferred.resolve(databaseIndex[database]);
                  })
                  .fail(() => {
                    dbDeferred.reject();
                  });
              }

              dbDeferred
                .done(dbEntry => {
                  dbEntry.catalogEntry
                    .getChildren({ silenceErrors: true })
                    .done(tableEntries => {
                      const tableName =
                        location.identifierChain[location.identifierChain.length - 1].name;
                      const found = tableEntries.some(tableEntry => {
                        if (tableEntry.name === tableName) {
                          const assistTableEntry = new AssistDbEntry(
                            tableEntry,
                            dbEntry,
                            assistDbSource,
                            this.filter,
                            i18n,
                            navigationSettings
                          );
                          activeTableIndex[
                            createQualifiedIdentifier(
                              location.identifierChain,
                              activeLocations.defaultDatabase
                            )
                          ] = assistTableEntry;
                          tableQidIndex[qid] = true;
                          updateTables = true;
                          tableDeferred.resolve(assistTableEntry);
                          return true;
                        }
                      });

                      if (!found) {
                        const missingEntry = new AssistDbEntry(
                          {
                            path: [dbEntry.catalogEntry.name, tableName],
                            name: tableName,
                            isTableOrView: () => true,
                            getType: () => 'table',
                            hasPossibleChildren: () => true,
                            getSourceMeta: () =>
                              $.Deferred()
                                .resolve({ notFound: true })
                                .promise(),
                            getDisplayName: () => dbEntry.catalogEntry.name + '.' + tableName,
                            reloading: ko.observable(false),
                            reload: function() {
                              const self = this;
                              if (self.reloading()) {
                                return;
                              }
                              self.reloading(true);
                              huePubSub.subscribeOnce('data.catalog.entry.refreshed', data => {
                                data.entry.getSourceMeta({ silenceErrors: true }).always(() => {
                                  self.reloading(false);
                                });
                              });
                              dataCatalog
                                .getEntry({
                                  sourceType: activeLocations.type,
                                  namespace: activeLocations.namespace,
                                  compute: activeLocations.compute,
                                  path: []
                                })
                                .done(sourceEntry => {
                                  sourceEntry
                                    .getChildren()
                                    .done(dbEntries => {
                                      let clearPromise;
                                      // Clear the database first if it exists without cascade
                                      const hasDb = dbEntries.some(dbEntry => {
                                        if (
                                          dbEntry.name.toLowerCase() === self.path[0].toLowerCase()
                                        ) {
                                          clearPromise = dbEntry.clearCache({
                                            invalidate: 'invalidate',
                                            cascade: false
                                          });
                                          return true;
                                        }
                                      });
                                      if (!hasDb) {
                                        // If the database is missing clear the source without cascade
                                        clearPromise = sourceEntry.clearCache({
                                          invalidate: 'invalidate',
                                          cascade: false
                                        });
                                      }
                                      clearPromise.fail(() => {
                                        self.reloading(false);
                                      });
                                    })
                                    .fail(() => {
                                      self.reloading(false);
                                    });
                                })
                                .fail(() => {
                                  self.reloading(false);
                                });
                            }
                          },
                          dbEntry,
                          assistDbSource,
                          this.filter,
                          i18n,
                          navigationSettings
                        );
                        activeTableIndex[
                          createQualifiedIdentifier(
                            location.identifierChain,
                            activeLocations.defaultDatabase
                          )
                        ] = missingEntry;
                        tableQidIndex[qid] = true;
                        updateTables = true;
                        missingEntry.hasErrors(true);
                        tableDeferred.resolve(missingEntry);
                      }
                    })
                    .fail(tableDeferred.reject);
                })
                .fail(tableDeferred.reject);
            }
          }
        });

        $.when.apply($, runningPromises).always(() => {
          runningPromises.length = 0;
          Object.keys(activeTableIndex).forEach(key => {
            if (!tableQidIndex[key]) {
              delete activeTableIndex[key];
              updateTables = true;
            }
          });

          if (updateTables) {
            const tables = [];
            Object.keys(activeTableIndex).forEach(key => {
              tables.push(activeTableIndex[key]);
            });

            tables.sort((a, b) => {
              return a.catalogEntry.name.localeCompare(b.catalogEntry.name);
            });
            this.activeTables(tables);
          }
        });
      }
    };

    const entryRefreshedSub = huePubSub.subscribe('data.catalog.entry.refreshed', details => {
      const sourceType = details.entry.getSourceType();
      if (sources[sourceType]) {
        let completeRefresh = false;
        if (details.entry.isSource()) {
          sources[sourceType].databaseIndex = {};
          sources[sourceType].activeTableIndex = {};
          completeRefresh = true;
        } else if (
          details.entry.isDatabase() &&
          sources[sourceType].databaseIndex[details.entry.name]
        ) {
          const dbEntry = sources[sourceType].databaseIndex[details.entry.name];
          const activeTableIndex = sources[sourceType].activeTableIndex;
          Object.keys(activeTableIndex).forEach(tableKey => {
            const tableEntry = activeTableIndex[tableKey];
            if (tableEntry.parent === dbEntry) {
              delete activeTableIndex[tableKey];
              completeRefresh = true;
            }
          });
        } else if (details.entry.isTableOrView()) {
          const activeTableIndex = sources[sourceType].activeTableIndex;
          if (activeTableIndex[details.entry.getQualifiedPath()]) {
            delete activeTableIndex[details.entry.getQualifiedPath()];
            completeRefresh = true;
          }
        }
        if (completeRefresh) {
          handleLocationUpdate(this.activeLocations());
        }
      }
    });

    if (this.activeTab() === 'editorAssistant') {
      huePubSub.publish('get.active.editor.locations', handleLocationUpdate);
    } else {
      updateOnVisible = true;
    }

    const activeTabSub = this.activeTab.subscribe(activeTab => {
      if (activeTab === 'editorAssistant' && updateOnVisible) {
        huePubSub.publish('get.active.editor.locations', handleLocationUpdate);
      }
    });

    this.disposals.push(() => {
      entryRefreshedSub.remove();
      activeTabSub.dispose();
    });

    const activeLocationsSub = huePubSub.subscribe('editor.active.locations', activeLocations => {
      if (this.activeTab() === 'editorAssistant') {
        handleLocationUpdate(activeLocations);
      } else {
        updateOnVisible = true;
      }
    });

    const activeRisksSub = huePubSub.subscribe('editor.active.risks', details => {
      if (details.risks !== this.activeRisks()) {
        this.activeRisks(details.risks);
        this.activeEditor(details.editor);
      }
    });

    huePubSub.publish('editor.get.active.risks', details => {
      this.activeRisks(details.risks);
      this.activeEditor(details.editor);
    });

    this.disposals.push(() => {
      activeLocationsSub.remove();
      activeRisksSub.remove();
    });
  }

  addFilter(riskId) {
    if (this.activeLocations() && this.activeEditor()) {
      this.activeLocations().activeStatementLocations.every(location => {
        let isLowerCase = false;
        if (
          this.activeLocations().activeStatementLocations &&
          this.activeLocations().activeStatementLocations.length > 0
        ) {
          const firstToken = this.activeLocations().activeStatementLocations[0].firstToken;
          isLowerCase = firstToken === firstToken.toLowerCase();
        }

        if (
          location.type === 'whereClause' &&
          !location.subquery &&
          (location.missing || riskId === 22)
        ) {
          this.activeEditor().moveCursorToPosition({
            row: location.location.last_line - 1,
            column: location.location.last_column - 1
          });
          this.activeEditor().clearSelection();

          if (/\S$/.test(this.activeEditor().getTextBeforeCursor())) {
            this.activeEditor().session.insert(this.activeEditor().getCursorPosition(), ' ');
          }

          const operation = location.missing ? 'WHERE ' : 'AND ';
          this.activeEditor().session.insert(
            this.activeEditor().getCursorPosition(),
            isLowerCase ? operation.toLowerCase() : operation
          );
          this.activeEditor().focus();

          if (riskId === 22) {
            huePubSub.publish('editor.autocomplete.temporary.sort.override', {
              partitionColumnsFirst: true
            });
          }

          window.setTimeout(() => {
            this.activeEditor().execCommand('startAutocomplete');
          }, 1);

          return false;
        }
        return true;
      });
    }
  }

  uploadTableStats(showProgress) {
    if (this.uploadingTableStats()) {
      return;
    }
    this.uploadingTableStats(true);
    huePubSub.publish('editor.upload.table.stats', {
      activeTables: this.activeTables(),
      showProgress: showProgress,
      callback: () => {
        this.uploadingTableStats(false);
      }
    });
  }

  dispose() {
    this.disposals.forEach(dispose => {
      dispose();
    });
  }
}

componentUtils.registerStaticComponent(
  'assist-editor-context-panel',
  AssistEditorContextPanel,
  TEMPLATE
);

export { TEMPLATE, AssistantUtils };
