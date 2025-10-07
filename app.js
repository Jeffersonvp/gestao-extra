(function() {
  'use strict';

  angular
    .module('gestaoApp', []);

  angular
    .module('gestaoApp')
    .factory('DataService', ['$http', '$q', function($http, $q) {
      var STORAGE_KEY = 'gestao_overtime_entries_v1';
      var VAC_STORAGE_KEY = 'gestao_vacations_v1';
      var apiReady = false;

      function tryApi() {
        return $http.get('/api/health', { timeout: 1500 }).then(function() {
          apiReady = true; return true;
        }, function() { apiReady = false; return false; });
      }

      function ensureLocalIds(list) {
        return (list || []).map(function(item) {
          if (item.id == null) item.id = Date.now() + Math.floor(Math.random() * 100000);
          return item;
        });
      }

      function loadEntriesLocal() {
        try {
          var raw = localStorage.getItem(STORAGE_KEY);
          var data = raw ? JSON.parse(raw) : [];
          data = ensureLocalIds(data);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          return data.map(function(r) { r.date = new Date(r.date); return r; });
        } catch (e) { return []; }
      }
      function saveEntriesLocal(list) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

      function loadVacationsLocal() {
        try {
          var raw = localStorage.getItem(VAC_STORAGE_KEY);
          var data = raw ? JSON.parse(raw) : [];
          data = ensureLocalIds(data);
          localStorage.setItem(VAC_STORAGE_KEY, JSON.stringify(data));
          return data.map(function(v) { v.startDate = new Date(v.startDate); v.endDate = new Date(v.endDate); return v; });
        } catch (e) { return []; }
      }
      function saveVacationsLocal(list) { localStorage.setItem(VAC_STORAGE_KEY, JSON.stringify(list)); }

      return {
        init: function() { return tryApi(); },
        getEntries: function() {
          if (apiReady) return $http.get('/api/entries').then(function(r){
            return (r.data || []).map(function(it){ it.date = new Date(it.date); return it; });
          }, function(){ return loadEntriesLocal(); });
          return $q.when(loadEntriesLocal());
        },
        createEntry: function(payload) {
          if (apiReady) return $http.post('/api/entries', payload).then(function(r){
            var it = r.data; it.date = new Date(it.date); return it;
          }, function(){
            var list = loadEntriesLocal();
            var item = Object.assign({ id: Date.now() + Math.floor(Math.random()*100000) }, payload);
            list.unshift(item); saveEntriesLocal(list); return item;
          });
          var list = loadEntriesLocal();
          var item = Object.assign({ id: Date.now() + Math.floor(Math.random()*100000) }, payload);
          list.unshift(item); saveEntriesLocal(list); return $q.when(item);
        },
        deleteEntry: function(id) {
          if (apiReady) return $http.delete('/api/entries/' + id).then(function(r){ return r.data; }, function(){
            var list = loadEntriesLocal();
            var idx = list.findIndex(function(e){ return e.id === id; });
            if (idx !== -1) { list.splice(idx, 1); saveEntriesLocal(list); }
            return {};
          });
          var list = loadEntriesLocal();
          var idx = list.findIndex(function(e){ return e.id === id; });
          if (idx !== -1) { list.splice(idx, 1); saveEntriesLocal(list); }
          return $q.when({});
        },
        getVacations: function() {
          if (apiReady) return $http.get('/api/vacations').then(function(r){
            return (r.data || []).map(function(v){ v.startDate = new Date(v.startDate); v.endDate = new Date(v.endDate); return v; });
          }, function(){ return loadVacationsLocal(); });
          return $q.when(loadVacationsLocal());
        },
        createVacation: function(payload) {
          if (apiReady) return $http.post('/api/vacations', payload).then(function(r){
            var it = r.data; it.startDate = new Date(it.startDate); it.endDate = new Date(it.endDate); return it;
          }, function(){
            var list = loadVacationsLocal();
            var item = Object.assign({ id: Date.now() + Math.floor(Math.random()*100000) }, payload);
            list.push(item); saveVacationsLocal(list); return item;
          });
          var list = loadVacationsLocal();
          var item = Object.assign({ id: Date.now() + Math.floor(Math.random()*100000) }, payload);
          list.push(item); saveVacationsLocal(list); return $q.when(item);
        },
        deleteVacation: function(id) {
          if (apiReady) return $http.delete('/api/vacations/' + id).then(function(r){ return r.data; }, function(){
            var list = loadVacationsLocal();
            var idx = list.findIndex(function(v){ return v.id === id; });
            if (idx !== -1) { list.splice(idx, 1); saveVacationsLocal(list); }
            return {};
          });
          var list = loadVacationsLocal();
          var idx = list.findIndex(function(v){ return v.id === id; });
          if (idx !== -1) { list.splice(idx, 1); saveVacationsLocal(list); }
          return $q.when({});
        }
      };
    }])
    .controller('OvertimeController', ['$scope', 'DataService', function($scope, DataService) {
      var STORAGE_KEY = 'gestao_overtime_entries_v1';
      var VAC_STORAGE_KEY = 'gestao_vacations_v1';

      $scope.entries = [];
      $scope.entry = createDefaultEntry();
      $scope.sortKey = 'date';
      $scope.reverse = true; // newest first
      $scope.sortExpression = sortExpression;
      $scope.searchTerm = '';
      $scope.added = false;
      $scope.selectedEmployee = '';
      $scope.employees = [];

      // vacations state
      $scope.vacations = [];
      $scope.vacation = createDefaultVacation();
      $scope.vacAdded = false;
      $scope.vacSearchTerm = '';
      $scope.vacSortKey = 'startDate';
      $scope.vacReverse = false;
      $scope.vacSortExpression = vacSortExpression;
      $scope.dateRangeInvalid = false;

      function createDefaultEntry() {
        return {
          name: '',
          reason: '',
          type: 'extra',
          date: new Date(),
          hours: null
        };
      }

      function createDefaultVacation() {
        var today = new Date();
        return {
          name: '',
          startDate: today,
          endDate: today,
          notes: ''
        };
      }

      function sortExpression(item) {
        if ($scope.sortKey === 'date') {
          return new Date(item.date);
        }
        return item[$scope.sortKey];
      }

      $scope.setSort = function(key) {
        if ($scope.sortKey === key) {
          $scope.reverse = !$scope.reverse;
        } else {
          $scope.sortKey = key;
          $scope.reverse = key === 'date' || key === 'hours' ? true : false;
        }
      };

      function recomputeEmployees() {
        var seen = Object.create(null);
        var names = [];
        ($scope.entries || []).forEach(function(r) {
          var n = (r.name || '').trim();
          if (!n) return;
          if (!seen[n]) {
            seen[n] = true;
            names.push(n);
          }
        });
        names.sort(function(a, b) { return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }); });
        $scope.employees = names;
      }

      $scope.employeeFilter = function(item) {
        if (!$scope.selectedEmployee) return true;
        return item && item.name === $scope.selectedEmployee;
      };

      $scope.totalHours = function() {
        var list = $scope.entries || [];
        if ($scope.selectedEmployee) {
          list = list.filter($scope.employeeFilter);
        }
        return list.reduce(function(sum, r) {
          var value = parseFloat(r.hours) || 0;
          return sum + value;
        }, 0);
      };

      $scope.addEntry = function(form) {
        form.$setSubmitted();
        if (form.$invalid) return;

        var payload = {
          name: $scope.entry.name.trim(),
          reason: $scope.entry.reason.trim(),
          type: $scope.entry.type,
          date: $scope.entry.date,
          hours: parseFloat($scope.entry.hours) * ($scope.entry.type === 'desconto' ? -1 : 1)
        };

        DataService.createEntry(payload).then(function(saved){
          $scope.entries.unshift(saved);
          recomputeEmployees();
          $scope.added = true;
          setTimeout(function(){ $scope.added = false; $scope.$applyAsync(); }, 1600);
          $scope.entry = createDefaultEntry();
          form.$setPristine();
          form.$setUntouched();
        });
      };

      $scope.formatSignedHours = function(value) {
        var n = parseFloat(value) || 0;
        var sign = n > 0 ? '+' : (n < 0 ? '-' : '');
        return sign + Math.abs(n).toFixed(2);
      };

      $scope.getInitials = function(name) {
        var n = (name || '').trim();
        if (!n) return '?';
        var parts = n.split(/\s+/).filter(Boolean);
        var first = parts[0] ? parts[0][0] : '';
        var last = parts.length > 1 ? parts[parts.length - 1][0] : '';
        return (first + last).toUpperCase();
      };

      // Export XLSX respecting filters and search
      $scope.exportEntriesXlsx = function() {
        try {
          var filtered = ($scope.entries || []).slice();
          // employee filter
          if ($scope.selectedEmployee) {
            filtered = filtered.filter($scope.employeeFilter);
          }
          // text search filter
          if ($scope.searchTerm) {
            var term = ($scope.searchTerm || '').toLowerCase();
            filtered = filtered.filter(function(it){
              return String(it.name||'').toLowerCase().indexOf(term) !== -1
                || String(it.reason||'').toLowerCase().indexOf(term) !== -1
                || (new Date(it.date)).toLocaleDateString('pt-BR').indexOf(term) !== -1
                || String(it.hours||'').toLowerCase().indexOf(term) !== -1;
            });
          }
          // sort
          filtered.sort(function(a, b){
            var va = ($scope.sortExpression(a));
            var vb = ($scope.sortExpression(b));
            if (va < vb) return $scope.reverse ? 1 : -1;
            if (va > vb) return $scope.reverse ? -1 : 1;
            return 0;
          });

          var rows = filtered.map(function(it){
            return {
              'Funcionário': it.name,
              'Motivo': it.reason,
              'Data': new Date(it.date).toISOString().slice(0,10),
              'Horas': it.hours
            };
          });
          var ws = XLSX.utils.json_to_sheet(rows);
          var wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Horas Extra');
          XLSX.writeFile(wb, 'horas_extra.xlsx');
        } catch (e) {
          // ignore export errors silently
        }
      };

      $scope.deleteEntry = function(item) {
        if (!item) return;
        DataService.deleteEntry(item.id).then(function(){
          var idx = $scope.entries.findIndex(function(e){ return e.id === item.id; });
          if (idx !== -1) { $scope.entries.splice(idx, 1); }
          recomputeEmployees();
        });
      };

      $scope.resetForm = function(form) {
        $scope.entry = createDefaultEntry();
        form.$setPristine();
        form.$setUntouched();
      };

      // vacations helpers
      function vacSortExpression(v) {
        if ($scope.vacSortKey === 'startDate') return new Date(v.startDate);
        return v[$scope.vacSortKey];
      }

      $scope.setVacSort = function(key) {
        if ($scope.vacSortKey === key) {
          $scope.vacReverse = !$scope.vacReverse;
        } else {
          $scope.vacSortKey = key;
          $scope.vacReverse = key === 'startDate' ? false : false;
        }
      };

      $scope.vacationDays = function(start, end) {
        var s = new Date(start);
        var e = new Date(end);
        var diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1; // inclusive
        return isFinite(diff) && diff > 0 ? diff : 0;
      };

      $scope.vacationUpcomingFilter = function(v) {
        var today = new Date();
        // zero time
        today.setHours(0,0,0,0);
        var end = new Date(v.endDate);
        end.setHours(0,0,0,0);
        return end >= today; // only current or future vacations
      };

      $scope.vacationStatus = function(v) {
        var today = new Date();
        today.setHours(0,0,0,0);
        var s = new Date(v.startDate); s.setHours(0,0,0,0);
        var e = new Date(v.endDate); e.setHours(0,0,0,0);
        if (e < today) return 'Encerradas';
        if (s > today) return 'Agendadas';
        return 'Em andamento';
      };

      $scope.vacationStatusClass = function(v) {
        var status = $scope.vacationStatus(v);
        if (status === 'Agendadas') return 'text-bg-info';
        if (status === 'Em andamento') return 'text-bg-warning';
        return 'text-bg-secondary';
      };

      $scope.upcomingVacationsCount = function() {
        return ($scope.vacations || []).filter($scope.vacationUpcomingFilter).length;
      };

      $scope.addVacation = function(form) {
        form.$setSubmitted();
        $scope.dateRangeInvalid = false;
        if (form.$invalid) return;

        var s = new Date($scope.vacation.startDate);
        var e = new Date($scope.vacation.endDate);
        if (e < s) {
          $scope.dateRangeInvalid = true;
          return;
        }

        var payload = {
          name: ($scope.vacation.name || '').trim(),
          startDate: s,
          endDate: e,
          notes: ($scope.vacation.notes || '').trim()
        };
        DataService.createVacation(payload).then(function(saved){
          $scope.vacations.push(saved);
          $scope.vacAdded = true;
          setTimeout(function(){ $scope.vacAdded = false; $scope.$applyAsync(); }, 1600);
          $scope.vacation = createDefaultVacation();
          form.$setPristine();
          form.$setUntouched();
        });
      };

      $scope.deleteVacation = function(item) {
        if (!item) return;
        DataService.deleteVacation(item.id).then(function(){
          var idx = $scope.vacations.findIndex(function(v){ return v.id === item.id; });
          if (idx !== -1) { $scope.vacations.splice(idx, 1); }
        });
      };

      function loadFromStorage() {
        try {
          var raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return [];
          var data = JSON.parse(raw) || [];
          // revive dates
          return data.map(function(r) {
            r.date = new Date(r.date);
            return r;
          });
        } catch (e) {
          return [];
        }
      }

      function loadVacationsFromStorage() {
        try {
          var raw = localStorage.getItem(VAC_STORAGE_KEY);
          if (!raw) return [];
          var data = JSON.parse(raw) || [];
          return data.map(function(v) {
            v.startDate = new Date(v.startDate);
            v.endDate = new Date(v.endDate);
            return v;
          });
        } catch (e) {
          return [];
        }
      }

      function saveToStorage(list) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (e) {
          // ignore quota errors
        }
      }

      function saveVacationsToStorage(list) {
        try {
          localStorage.setItem(VAC_STORAGE_KEY, JSON.stringify(list));
        } catch (e) {
          // ignore quota errors
        }
      }

      // init: check API and load data
      DataService.init().finally(function(){
        DataService.getEntries().then(function(list){ $scope.entries = list; recomputeEmployees(); });
        DataService.getVacations().then(function(list){ $scope.vacations = list; });
        $scope.$applyAsync();
      });
    }]);
})();


