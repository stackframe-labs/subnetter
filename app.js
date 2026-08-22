/*
 * app.js
 *
 * DOM wiring only. All actual subnetting math lives in subnet.js
 * (loaded as window.Subnet before this file runs).
 */
(function () {
  'use strict';

  var S = window.Subnet;

  // ---------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------

  var tabButtons = document.querySelectorAll('.tab-btn');
  var panels = document.querySelectorAll('.panel');

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.getAttribute('data-tab');

      tabButtons.forEach(function (b) {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });

      panels.forEach(function (p) {
        p.classList.toggle('active', p.id === 'panel-' + target);
      });
    });
  });

  // ---------------------------------------------------------------------
  // Small DOM helpers
  // ---------------------------------------------------------------------

  function showError(el, message) {
    el.textContent = message;
    el.hidden = false;
  }

  function hideError(el) {
    el.hidden = true;
    el.textContent = '';
  }

  function resultItem(label, value, full) {
    var div = document.createElement('div');
    div.className = 'result-item' + (full ? ' full' : '');
    var l = document.createElement('span');
    l.className = 'label';
    l.textContent = label;
    var v = document.createElement('span');
    v.className = 'value';
    v.textContent = value;
    div.appendChild(l);
    div.appendChild(v);
    return div;
  }

  // ---------------------------------------------------------------------
  // IPv4 Calculator
  // ---------------------------------------------------------------------

  var ipv4Form = document.getElementById('ipv4-form');
  var ipv4Error = document.getElementById('ipv4-error');
  var ipv4Results = document.getElementById('ipv4-results');

  function runIPv4Calc() {
    var ip = document.getElementById('ipv4-address').value;
    var prefixInput = document.getElementById('ipv4-prefix').value.trim();

    hideError(ipv4Error);
    ipv4Results.hidden = true;
    ipv4Results.innerHTML = '';

    try {
      var opts = prefixInput.indexOf('.') !== -1 ? { mask: prefixInput } : { prefix: prefixInput };
      var r = S.calculateIPv4Subnet(ip, opts);

      var items = [
        ['Network Address', r.network],
        ['Broadcast Address', r.broadcast],
        ['First Usable Host', r.firstHost],
        ['Last Usable Host', r.lastHost],
        ['Subnet Mask', r.subnetMask + ' (/' + r.cidr + ')'],
        ['Wildcard Mask', r.wildcardMask],
        ['Total Addresses', r.totalHosts.toLocaleString()],
        ['Usable Hosts', r.usableHosts.toLocaleString()],
        ['IP in Binary', r.ipBinary],
        ['Network in Binary', r.networkBinary]
      ];

      items.forEach(function (pair) {
        var full = pair[0].indexOf('Binary') !== -1;
        ipv4Results.appendChild(resultItem(pair[0], pair[1], full));
      });

      ipv4Results.hidden = false;
    } catch (err) {
      showError(ipv4Error, err.message);
    }
  }

  ipv4Form.addEventListener('submit', function (e) {
    e.preventDefault();
    runIPv4Calc();
  });
  ['ipv4-address', 'ipv4-prefix'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', runIPv4Calc);
  });

  // ---------------------------------------------------------------------
  // VLSM Planner
  // ---------------------------------------------------------------------

  var vlsmForm = document.getElementById('vlsm-form');
  var vlsmError = document.getElementById('vlsm-error');
  var vlsmSummary = document.getElementById('vlsm-summary');
  var vlsmTable = document.getElementById('vlsm-table');

  function parseHostList(str) {
    var parts = str.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
    if (parts.length === 0) throw new Error('Enter at least one required host count, e.g. "50, 20, 10, 5"');
    return parts.map(function (p) {
      if (!/^\d+$/.test(p)) throw new Error('"' + p + '" is not a valid whole number of hosts');
      var n = parseInt(p, 10);
      if (n < 1) throw new Error('Host counts must be at least 1 (got "' + p + '")');
      return n;
    });
  }

  function runVLSM() {
    var base = document.getElementById('vlsm-base').value.trim();
    var hostsStr = document.getElementById('vlsm-hosts').value;

    hideError(vlsmError);
    vlsmSummary.hidden = true;
    vlsmTable.hidden = true;
    var tbody = vlsmTable.querySelector('tbody');
    tbody.innerHTML = '';

    try {
      var hostList = parseHostList(hostsStr);
      var result = S.calculateVLSM(base, hostList);

      vlsmSummary.innerHTML =
        'Base network <strong>' + result.base.cidr + '</strong> provides <strong>' +
        result.totalAddressesAvailable.toLocaleString() + '</strong> addresses. This plan uses <strong>' +
        result.totalAddressesUsed.toLocaleString() + '</strong> (' +
        Math.round((result.totalAddressesUsed / result.totalAddressesAvailable) * 100) + '%).';
      vlsmSummary.hidden = false;

      result.allocations.forEach(function (a, i) {
        var tr = document.createElement('tr');
        [
          i + 1,
          a.hostsRequested,
          a.cidr,
          a.subnetMask,
          a.network,
          a.broadcast,
          a.firstHost + ' - ' + a.lastHost,
          a.usableHosts
        ].forEach(function (val) {
          var td = document.createElement('td');
          td.textContent = val;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      vlsmTable.hidden = false;
    } catch (err) {
      showError(vlsmError, err.message);
    }
  }

  vlsmForm.addEventListener('submit', function (e) {
    e.preventDefault();
    runVLSM();
  });

  // ---------------------------------------------------------------------
  // IPv6 Calculator
  // ---------------------------------------------------------------------

  var ipv6Form = document.getElementById('ipv6-form');
  var ipv6Error = document.getElementById('ipv6-error');
  var ipv6Results = document.getElementById('ipv6-results');

  function runIPv6Calc() {
    var addr = document.getElementById('ipv6-address').value;
    var prefix = document.getElementById('ipv6-prefix').value.trim();

    hideError(ipv6Error);
    ipv6Results.hidden = true;
    ipv6Results.innerHTML = '';

    try {
      var r = S.calculateIPv6Subnet(addr, prefix);

      var items = [
        ['Compressed', r.compressed, true],
        ['Expanded', r.expanded, true],
        ['Network Prefix', r.networkCidr, true],
        ['Network (expanded)', r.network, true],
        ['Last Address in Subnet', r.lastAddressCompressed, true],
        ['Total Addresses in Subnet', r.totalAddresses, true]
      ];

      items.forEach(function (pair) {
        ipv6Results.appendChild(resultItem(pair[0], pair[1], pair[2]));
      });

      ipv6Results.hidden = false;
    } catch (err) {
      showError(ipv6Error, err.message);
    }
  }

  ipv6Form.addEventListener('submit', function (e) {
    e.preventDefault();
    runIPv6Calc();
  });
  ['ipv6-address', 'ipv6-prefix'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', runIPv6Calc);
  });

  // ---------------------------------------------------------------------
  // CIDR <-> Mask Converter
  // ---------------------------------------------------------------------

  var convCidr = document.getElementById('conv-cidr');
  var convMask = document.getElementById('conv-mask');
  var convError = document.getElementById('conv-error');
  var convWildcard = document.getElementById('conv-wildcard');
  var convTableBody = document.querySelector('#conv-table tbody');

  var suppressConvSync = false;

  function updateWildcardDisplay(prefix) {
    try {
      convWildcard.textContent = 'Wildcard mask: ' + S.cidrToWildcard(prefix);
    } catch (e) {
      convWildcard.textContent = '';
    }
  }

  function syncFromCidr() {
    if (suppressConvSync) return;
    hideError(convError);
    var val = convCidr.value.trim();
    if (val === '') return;
    try {
      var prefix = S.parsePrefix(val);
      suppressConvSync = true;
      convMask.value = S.cidrToMask(prefix);
      suppressConvSync = false;
      updateWildcardDisplay(prefix);
    } catch (err) {
      showError(convError, err.message);
    }
  }

  function syncFromMask() {
    if (suppressConvSync) return;
    hideError(convError);
    var val = convMask.value.trim();
    if (val === '') return;
    try {
      var prefix = S.maskToCidr(val);
      suppressConvSync = true;
      convCidr.value = String(prefix);
      suppressConvSync = false;
      updateWildcardDisplay(prefix);
    } catch (err) {
      showError(convError, err.message);
    }
  }

  convCidr.addEventListener('input', syncFromCidr);
  convMask.addEventListener('input', syncFromMask);

  function buildReferenceTable() {
    convTableBody.innerHTML = '';
    for (var prefix = 0; prefix <= 32; prefix++) {
      var mask = S.cidrToMask(prefix);
      var wildcard = S.cidrToWildcard(prefix);
      var usable;
      if (prefix >= 31) {
        usable = prefix === 32 ? 1 : 2;
      } else {
        usable = Math.pow(2, 32 - prefix) - 2;
      }
      var tr = document.createElement('tr');
      ['/' + prefix, mask, wildcard, usable.toLocaleString()].forEach(function (val) {
        var td = document.createElement('td');
        td.textContent = val;
        tr.appendChild(td);
      });
      convTableBody.appendChild(tr);
    }
  }

  // ---------------------------------------------------------------------
  // Initial render
  // ---------------------------------------------------------------------

  runIPv4Calc();
  runVLSM();
  runIPv6Calc();
  syncFromCidr();
  buildReferenceTable();
})();
