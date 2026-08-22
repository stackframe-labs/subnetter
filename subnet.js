/*
 * subnet.js
 *
 * Pure calculation logic for the Subnetter app.
 * No DOM access anywhere in this file - everything here is a plain,
 * testable function. Works both as a browser <script> (attaches to
 * window.Subnet) and as a CommonJS module for Node ("node --test").
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = mod;
  }
  if (root) {
    root.Subnet = mod;
  }
})(typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : this), function () {
  'use strict';

  // ---------------------------------------------------------------------
  // IPv4 helpers
  // ---------------------------------------------------------------------

  /**
   * Parse a dotted-decimal IPv4 string into an array of 4 integer octets.
   * Throws an Error with a human readable message on anything invalid.
   */
  function parseIPv4(str) {
    if (typeof str !== 'string') throw new Error('IPv4 address must be a string');
    var trimmed = str.trim();
    if (trimmed === '') throw new Error('IPv4 address is required');
    var parts = trimmed.split('.');
    if (parts.length !== 4) {
      throw new Error('IPv4 address must have exactly 4 octets (got "' + trimmed + '")');
    }
    var octets = [];
    for (var i = 0; i < 4; i++) {
      var p = parts[i];
      if (!/^\d{1,3}$/.test(p)) {
        throw new Error('Octet "' + p + '" is not a valid number');
      }
      var n = parseInt(p, 10);
      if (n < 0 || n > 255) {
        throw new Error('Octet "' + p + '" must be between 0 and 255');
      }
      // reject things like "01" only if you want strict canonical form;
      // we allow leading zeros for user convenience.
      octets.push(n);
    }
    return octets;
  }

  /** Convert 4 octets to an unsigned 32-bit integer. */
  function octetsToInt(octets) {
    return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
  }

  /** Convert an IPv4 dotted string directly to an unsigned 32-bit integer. */
  function ipToInt(str) {
    return octetsToInt(parseIPv4(str));
  }

  /** Convert an unsigned 32-bit integer to a dotted-decimal string. */
  function intToIp(int) {
    int = int >>> 0;
    return [
      (int >>> 24) & 0xff,
      (int >>> 16) & 0xff,
      (int >>> 8) & 0xff,
      int & 0xff
    ].join('.');
  }

  /** Validate and normalize a CIDR prefix length (0-32). */
  function parsePrefix(prefix) {
    var n;
    if (typeof prefix === 'number') {
      n = prefix;
    } else {
      var s = String(prefix).trim();
      if (!/^\d{1,2}$/.test(s)) throw new Error('CIDR prefix "' + prefix + '" is not a valid integer');
      n = parseInt(s, 10);
    }
    if (!Number.isInteger(n) || n < 0 || n > 32) {
      throw new Error('CIDR prefix must be an integer between 0 and 32 (got "' + prefix + '")');
    }
    return n;
  }

  /** Convert a CIDR prefix length to a 32-bit mask integer. */
  function cidrToMaskInt(prefix) {
    prefix = parsePrefix(prefix);
    if (prefix === 0) return 0;
    return (0xffffffff << (32 - prefix)) >>> 0;
  }

  /** Convert a CIDR prefix length (0-32) to a dotted-decimal subnet mask. */
  function cidrToMask(prefix) {
    return intToIp(cidrToMaskInt(prefix));
  }

  /**
   * Convert a dotted-decimal subnet mask to a CIDR prefix length.
   * Throws if the mask is not a valid contiguous subnet mask.
   */
  function maskToCidr(maskStr) {
    var octets = parseIPv4(maskStr);
    var maskInt = octetsToInt(octets);
    // A valid mask, in binary, is a run of 1s followed by a run of 0s.
    // Equivalent check: (~mask + 1) & ~mask === 0 for non-zero masks (power of two check
    // for the "inverted" part), but simplest is to compare against every legal mask.
    var inverted = (~maskInt) >>> 0;
    // inverted + 1 must be a power of two (or 0, meaning mask was all 1s / prefix 32)
    if (((inverted & (inverted + 1)) >>> 0) !== 0) {
      throw new Error('"' + maskStr + '" is not a valid contiguous subnet mask');
    }
    // count set bits
    var prefix = 0;
    for (var i = 31; i >= 0; i--) {
      if ((maskInt >>> i) & 1) prefix++;
      else break;
    }
    // Verify recomputed mask matches exactly (guards against non-contiguous like 255.0.255.0)
    if (cidrToMaskInt(prefix) !== maskInt) {
      throw new Error('"' + maskStr + '" is not a valid contiguous subnet mask');
    }
    return prefix;
  }

  /** Wildcard mask (inverse of subnet mask) as a dotted-decimal string. */
  function cidrToWildcard(prefix) {
    var maskInt = cidrToMaskInt(prefix);
    return intToIp((~maskInt) >>> 0);
  }

  /** Render 4 octets as a binary string, grouped per octet, e.g. "11000000.10101000.00000001.00000000". */
  function octetsToBinary(octets) {
    return octets.map(function (o) {
      return o.toString(2).padStart(8, '0');
    }).join('.');
  }

  /** Render a dotted IPv4 string as grouped binary. */
  function ipToBinary(str) {
    return octetsToBinary(parseIPv4(str));
  }

  /**
   * Full IPv4 subnet calculation.
   * Accepts either a `prefix` (0-32) or a `mask` (dotted decimal) - at least
   * one must be supplied.
   *
   * Returns an object with every field required by the calculator UI.
   */
  function calculateIPv4Subnet(ip, prefixOrOptions, maybeMask) {
    var prefix, mask;
    if (typeof prefixOrOptions === 'object' && prefixOrOptions !== null) {
      prefix = prefixOrOptions.prefix;
      mask = prefixOrOptions.mask;
    } else {
      prefix = prefixOrOptions;
      mask = maybeMask;
    }

    var octets = parseIPv4(ip);
    var ipInt = octetsToInt(octets);

    var cidr;
    if (prefix !== undefined && prefix !== null && prefix !== '') {
      cidr = parsePrefix(prefix);
    } else if (mask) {
      cidr = maskToCidr(mask);
    } else {
      throw new Error('Either a CIDR prefix or a subnet mask is required');
    }

    var maskInt = cidrToMaskInt(cidr);
    var wildcardInt = (~maskInt) >>> 0;
    var networkInt = (ipInt & maskInt) >>> 0;
    var broadcastInt = (networkInt | wildcardInt) >>> 0;
    var totalAddresses = Math.pow(2, 32 - cidr);

    var firstHostInt, lastHostInt, usableHosts;
    if (cidr === 32) {
      firstHostInt = networkInt;
      lastHostInt = networkInt;
      usableHosts = 1;
    } else if (cidr === 31) {
      // RFC 3021 point-to-point link: both addresses are usable, no network/broadcast.
      firstHostInt = networkInt;
      lastHostInt = broadcastInt;
      usableHosts = 2;
    } else {
      firstHostInt = (networkInt + 1) >>> 0;
      lastHostInt = (broadcastInt - 1) >>> 0;
      usableHosts = totalAddresses - 2;
    }

    return {
      input: { ip: intToIp(ipInt), prefix: cidr },
      ipBinary: octetsToBinary(octets),
      network: intToIp(networkInt),
      networkBinary: octetsToBinary([
        (networkInt >>> 24) & 0xff, (networkInt >>> 16) & 0xff, (networkInt >>> 8) & 0xff, networkInt & 0xff
      ]),
      broadcast: intToIp(broadcastInt),
      firstHost: intToIp(firstHostInt),
      lastHost: intToIp(lastHostInt),
      totalHosts: totalAddresses,
      usableHosts: usableHosts,
      subnetMask: intToIp(maskInt),
      wildcardMask: intToIp(wildcardInt),
      cidr: cidr,
      networkInt: networkInt,
      broadcastInt: broadcastInt
    };
  }

  // ---------------------------------------------------------------------
  // VLSM planner
  // ---------------------------------------------------------------------

  /**
   * Smallest block size (number of addresses, a power of two) that can
   * accommodate `hostsNeeded` usable hosts, reserving one address each for
   * network and broadcast (the standard VLSM teaching convention).
   * Minimum block is 4 addresses (a /30) since that's the smallest subnet
   * that still has a distinct network/broadcast/usable-host structure.
   */
  function blockSizeForHosts(hostsNeeded) {
    if (!Number.isInteger(hostsNeeded) || hostsNeeded < 1) {
      throw new Error('Host requirement must be a positive integer (got "' + hostsNeeded + '")');
    }
    var needed = hostsNeeded + 2; // network + broadcast
    var size = 4; // minimum usable block (/30)
    while (size < needed) size *= 2;
    return size;
  }

  function blockSizeToPrefix(blockSize) {
    return 32 - Math.round(Math.log2(blockSize));
  }

  /**
   * Compute a VLSM allocation.
   *
   * @param {string} baseCidr - e.g. "192.168.1.0/24"
   * @param {number[]} hostRequirements - e.g. [50, 20, 10, 5]
   * @returns {object} { base: {...}, allocations: [...] }
   * @throws Error if the requirements do not fit inside the base network.
   */
  function calculateVLSM(baseCidr, hostRequirements) {
    if (typeof baseCidr !== 'string' || baseCidr.indexOf('/') === -1) {
      throw new Error('Base network must be in CIDR form, e.g. "192.168.1.0/24"');
    }
    var pieces = baseCidr.split('/');
    var baseIp = pieces[0];
    var basePrefix = parsePrefix(pieces[1]);

    var baseOctets = parseIPv4(baseIp);
    var baseIpInt = octetsToInt(baseOctets);
    var baseMaskInt = cidrToMaskInt(basePrefix);
    var baseNetworkInt = (baseIpInt & baseMaskInt) >>> 0;
    var baseTotalAddresses = Math.pow(2, 32 - basePrefix);

    if (!Array.isArray(hostRequirements) || hostRequirements.length === 0) {
      throw new Error('At least one host requirement is required');
    }

    // Build requests, remembering original order/index for the final output.
    var requests = hostRequirements.map(function (hosts, index) {
      var blockSize = blockSizeForHosts(hosts);
      return {
        index: index,
        hostsRequested: hosts,
        blockSize: blockSize,
        prefix: blockSizeToPrefix(blockSize)
      };
    });

    // Sort largest block first (VLSM "first-fit decreasing" allocation).
    var sorted = requests.slice().sort(function (a, b) {
      return b.blockSize - a.blockSize;
    });

    var totalNeeded = sorted.reduce(function (sum, r) { return sum + r.blockSize; }, 0);
    if (totalNeeded > baseTotalAddresses) {
      throw new Error(
        'Requested subnets need ' + totalNeeded + ' addresses total, but ' +
        baseCidr + ' only provides ' + baseTotalAddresses + '. Requirements do not fit.'
      );
    }

    var cursor = baseNetworkInt;
    var allocations = [];
    for (var i = 0; i < sorted.length; i++) {
      var req = sorted[i];
      var networkInt = cursor;
      var broadcastInt = (networkInt + req.blockSize - 1) >>> 0;

      if (broadcastInt > (baseNetworkInt + baseTotalAddresses - 1)) {
        throw new Error(
          'Subnet for ' + req.hostsRequested + ' hosts does not fit within ' + baseCidr + '.'
        );
      }

      var firstHostInt = (networkInt + 1) >>> 0;
      var lastHostInt = (broadcastInt - 1) >>> 0;

      allocations.push({
        index: req.index,
        hostsRequested: req.hostsRequested,
        prefix: req.prefix,
        cidr: intToIp(networkInt) + '/' + req.prefix,
        network: intToIp(networkInt),
        broadcast: intToIp(broadcastInt),
        firstHost: intToIp(firstHostInt),
        lastHost: intToIp(lastHostInt),
        subnetMask: intToIp(cidrToMaskInt(req.prefix)),
        totalAddresses: req.blockSize,
        usableHosts: req.blockSize - 2,
        networkInt: networkInt,
        broadcastInt: broadcastInt
      });

      cursor = (cursor + req.blockSize) >>> 0;
    }

    // Return allocations re-sorted back into the caller's original request order.
    allocations.sort(function (a, b) { return a.index - b.index; });

    return {
      base: {
        cidr: baseCidr,
        network: intToIp(baseNetworkInt),
        prefix: basePrefix,
        totalAddresses: baseTotalAddresses
      },
      totalAddressesUsed: totalNeeded,
      totalAddressesAvailable: baseTotalAddresses,
      allocations: allocations
    };
  }

  // ---------------------------------------------------------------------
  // IPv6 helpers
  // ---------------------------------------------------------------------

  /**
   * Expand an IPv6 address string into an array of 8 lowercase 4-hex-digit
   * groups. Throws a descriptive Error on invalid input.
   */
  function expandIPv6Groups(str) {
    if (typeof str !== 'string') throw new Error('IPv6 address must be a string');
    var addr = str.trim();
    if (addr === '') throw new Error('IPv6 address is required');

    if (!/^[0-9a-fA-F:]+$/.test(addr)) {
      throw new Error('"' + str + '" contains characters that are not valid in an IPv6 address');
    }

    var doubleColonCount = (addr.match(/::/g) || []).length;
    if (doubleColonCount > 1) {
      throw new Error('IPv6 address can only contain one "::"');
    }

    var groups;
    if (doubleColonCount === 1) {
      var sides = addr.split('::');
      var head = sides[0];
      var tail = sides[1];
      var headParts = head === '' ? [] : head.split(':');
      var tailParts = tail === '' ? [] : tail.split(':');

      if (headParts.indexOf('') !== -1 || tailParts.indexOf('') !== -1) {
        throw new Error('"' + str + '" has an empty group; check colon placement');
      }

      var missing = 8 - (headParts.length + tailParts.length);
      if (missing < 1) {
        throw new Error('"' + str + '" has too many groups to use "::" compression');
      }
      groups = headParts.concat(new Array(missing).fill('0')).concat(tailParts);
    } else {
      groups = addr.split(':');
      if (groups.length !== 8) {
        throw new Error('IPv6 address must have 8 groups, or use "::" for compression (got ' + groups.length + ')');
      }
      if (groups.indexOf('') !== -1) {
        throw new Error('"' + str + '" has an empty group; check colon placement');
      }
    }

    return groups.map(function (g) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) {
        throw new Error('"' + g + '" is not a valid IPv6 group');
      }
      return g.toLowerCase().padStart(4, '0');
    });
  }

  /** Fully expanded, colon-separated IPv6 string (8 groups of 4 hex digits). */
  function expandIPv6(str) {
    return expandIPv6Groups(str).join(':');
  }

  /**
   * Canonical compressed IPv6 form per RFC 5952: longest run of consecutive
   * all-zero groups (length >= 2, leftmost wins ties) is replaced with "::",
   * leading zeros within each remaining group are stripped.
   */
  function compressIPv6(strOrGroups) {
    var groups = Array.isArray(strOrGroups) ? strOrGroups.slice() : expandIPv6Groups(strOrGroups);
    var trimmed = groups.map(function (g) {
      var t = g.replace(/^0+(?=.)/, '').toLowerCase();
      return t === '' ? '0' : t;
    });

    // Find the longest run of "0" groups.
    var bestStart = -1, bestLen = 0;
    var curStart = -1, curLen = 0;
    for (var i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === '0') {
        if (curStart === -1) curStart = i;
        curLen++;
        if (curLen > bestLen) {
          bestLen = curLen;
          bestStart = curStart;
        }
      } else {
        curStart = -1;
        curLen = 0;
      }
    }

    if (bestLen < 2) {
      return trimmed.join(':');
    }

    var before = trimmed.slice(0, bestStart);
    var after = trimmed.slice(bestStart + bestLen);

    if (before.length === 0 && after.length === 0) return '::';
    if (before.length === 0) return '::' + after.join(':');
    if (after.length === 0) return before.join(':') + '::';
    return before.join(':') + '::' + after.join(':');
  }

  /** Convert 8 hex groups (strings) into a single BigInt. */
  function groupsToBigInt(groups) {
    var acc = 0n;
    for (var i = 0; i < groups.length; i++) {
      acc = (acc << 16n) + BigInt(parseInt(groups[i], 16));
    }
    return acc;
  }

  /** Convert a BigInt (0 to 2^128-1) into an array of 8 lowercase 4-digit hex groups. */
  function bigIntToGroups(big) {
    var groups = [];
    var mask = 0xffffn;
    for (var i = 7; i >= 0; i--) {
      var shift = BigInt(i * 16);
      var part = (big >> shift) & mask;
      groups.push(part.toString(16).padStart(4, '0'));
    }
    return groups;
  }

  function parsePrefix128(prefix) {
    var n;
    if (typeof prefix === 'number') {
      n = prefix;
    } else {
      var s = String(prefix).trim();
      if (!/^\d{1,3}$/.test(s)) throw new Error('Prefix length "' + prefix + '" is not a valid integer');
      n = parseInt(s, 10);
    }
    if (!Number.isInteger(n) || n < 0 || n > 128) {
      throw new Error('IPv6 prefix length must be an integer between 0 and 128 (got "' + prefix + '")');
    }
    return n;
  }

  /**
   * Full IPv6 subnet calculation: expanded/compressed forms, network prefix,
   * and total addresses in the subnet (as a decimal string, since it can
   * exceed Number.MAX_SAFE_INTEGER).
   */
  function calculateIPv6Subnet(address, prefixLength) {
    var groups = expandIPv6Groups(address);
    var prefix = parsePrefix128(prefixLength);

    var addrBig = groupsToBigInt(groups);
    var fullMask = (1n << 128n) - 1n;
    var hostBits = 128 - prefix;
    var maskBig = hostBits === 0 ? fullMask : (fullMask ^ ((1n << BigInt(hostBits)) - 1n));
    var networkBig = addrBig & maskBig;
    var networkGroups = bigIntToGroups(networkBig);

    var totalAddresses = (2n ** BigInt(hostBits)).toString();

    var lastBig = networkBig | ((1n << BigInt(hostBits)) - (hostBits === 0 ? 0n : 1n));
    var lastGroups = bigIntToGroups(lastBig);

    return {
      input: { address: groups.join(':'), prefix: prefix },
      expanded: groups.join(':'),
      compressed: compressIPv6(groups),
      network: networkGroups.join(':'),
      networkCompressed: compressIPv6(networkGroups),
      networkCidr: compressIPv6(networkGroups) + '/' + prefix,
      lastAddress: lastGroups.join(':'),
      lastAddressCompressed: compressIPv6(lastGroups),
      prefix: prefix,
      totalAddresses: totalAddresses
    };
  }

  return {
    // IPv4
    parseIPv4: parseIPv4,
    ipToInt: ipToInt,
    intToIp: intToIp,
    parsePrefix: parsePrefix,
    cidrToMask: cidrToMask,
    cidrToMaskInt: cidrToMaskInt,
    maskToCidr: maskToCidr,
    cidrToWildcard: cidrToWildcard,
    ipToBinary: ipToBinary,
    octetsToBinary: octetsToBinary,
    calculateIPv4Subnet: calculateIPv4Subnet,
    // VLSM
    blockSizeForHosts: blockSizeForHosts,
    blockSizeToPrefix: blockSizeToPrefix,
    calculateVLSM: calculateVLSM,
    // IPv6
    expandIPv6Groups: expandIPv6Groups,
    expandIPv6: expandIPv6,
    compressIPv6: compressIPv6,
    groupsToBigInt: groupsToBigInt,
    bigIntToGroups: bigIntToGroups,
    calculateIPv6Subnet: calculateIPv6Subnet
  };
});
