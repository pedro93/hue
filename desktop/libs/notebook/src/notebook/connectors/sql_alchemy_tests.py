#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Licensed to Cloudera, Inc. under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  Cloudera, Inc. licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import logging

from mock import patch, Mock, MagicMock
from nose.tools import assert_equal, assert_not_equal, assert_true, assert_false

from django.contrib.auth.models import User

from desktop.auth.backend import rewrite_user
from desktop.lib.django_test_util import make_logged_in_client
from desktop.lib.test_utils import add_to_group, grant_access

from notebook.connectors.sql_alchemy import SqlAlchemyApi


LOG = logging.getLogger(__name__)


class TestApi():

  def setUp(self):
    self.client = make_logged_in_client(username="test", groupname="default", recreate=True, is_superuser=False)

    self.user = rewrite_user(User.objects.get(username="test"))
    grant_access("test", "default", "notebook")


  def test_fetch_result_empty(self):
    interpreter = {
      'options': {}
    }

    notebook = Mock()
    snippet = {'result': {'handle': {'guid': 'guid-1'}}}
    rows = 10
    start_over = True

    with patch('notebook.connectors.sql_alchemy.CONNECTION_CACHE') as CONNECTION_CACHE:
      CONNECTION_CACHE.get = Mock(
        return_value={
          'result': Mock(
            fetchmany=Mock(return_value=[]) # We have 0 rows
          ),
          'meta': MagicMock(
            __getitem__=Mock(return_value={'type': 'BIGINT_TYPE'}),
            return_value=[{'type': 'BIGINT_TYPE'}]
          )
        }
      )

      data = SqlAlchemyApi(self.user, interpreter).fetch_result(notebook, snippet, rows, start_over)

      assert_false(data['has_more'])
      assert_not_equal(data['has_more'], [])
      assert_equal(data['has_more'], False)

      assert_equal(data['data'], [])
      assert_equal(data['meta'](), [{'type': 'BIGINT_TYPE'}])


  def test_fetch_result_rows(self):
    interpreter = {
      'options': {}
    }

    notebook = Mock()
    snippet = {'result': {'handle': {'guid': 'guid-1'}}}
    rows = 10
    start_over = True

    with patch('notebook.connectors.sql_alchemy.CONNECTION_CACHE') as CONNECTION_CACHE:
      CONNECTION_CACHE.get = Mock(
        return_value={
          'result': Mock(
            fetchmany=Mock(return_value=[['row1'], ['row2']]) # We have 2 rows
          ),
          'meta': MagicMock(
            __getitem__=Mock(return_value={'type': 'BIGINT_TYPE'}),
            return_value=[{'type': 'BIGINT_TYPE'}]
          )
        }
      )

      data = SqlAlchemyApi(self.user, interpreter).fetch_result(notebook, snippet, rows, start_over)

      assert_false(data['has_more'])
      assert_not_equal(data['has_more'], [])
      assert_equal(data['has_more'], False)

      assert_equal(data['data'], [['row1'], ['row2']])
      assert_equal(data['meta'](), [{'type': 'BIGINT_TYPE'}])
