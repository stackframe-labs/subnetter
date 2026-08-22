'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Subnet = require('../subnet.js');

// ---------------------------------------------------------------------
// IPv4 subnet calculator - hand-verified examples
// ---------------------------------------------------------------------

test('IPv4: 192.168.1.0/24 - classic class-C sized network', () => {
  const r = Subnet.calculateIPv4Subnet('192.168.1.0', 24);
  assert.equal(r.network, '192.168.1.0');
  assert.equal(r.broadcast, '192.168.1.255');
  assert.equal(r.firstHost, '192.168.1.1');
  assert.equal(r.lastHost, '192.168.1.254');
  assert.equal(r.totalHosts, 256);
  assert.equal(r.usableHosts, 254);
  assert.equal(r.subnetMask, '255.255.255.0');
  assert.equal(r.wildcardMask, '0.0.0.255');
});

test('IPv4: 10.0.0.0/8 - large class-A sized network', () => {
  const r = Subnet.calculateIPv4Subnet('10.0.0.0', 8);
  assert.equal(r.network, '10.0.0.0');
  assert.equal(r.broadcast, '10.255.255.255');
  assert.equal(r.firstHost, '10.0.0.1');
  assert.equal(r.lastHost, '10.255.255.254');
  assert.equal(r.totalHosts, 16777216);
  assert.equal(r.usableHosts, 16777214);
  assert.equal(r.subnetMask, '255.0.0.0');
  assert.equal(r.wildcardMask, '0.255.255.255');
});

test('IPv4: 192.168.1.4/30 - point-to-point WAN link', () => {
  const r = Subnet.calculateIPv4Subnet('192.168.1.4', 30);
  assert.equal(r.network, '192.168.1.4');
  assert.equal(r.broadcast, '192.168.1.7');
  assert.equal(r.firstHost, '192.168.1.5');
  assert.equal(r.lastHost, '192.168.1.6');
  assert.equal(r.totalHosts, 4);
  assert.equal(r.usableHosts, 2);
  assert.equal(r.subnetMask, '255.255.255.252');
  assert.equal(r.wildcardMask, '0.0.0.3');
});

test('IPv4: 192.168.1.1/32 - single host route', () => {
  const r = Subnet.calculateIPv4Subnet('192.168.1.1', 32);
  assert.equal(r.network, '192.168.1.1');
  assert.equal(r.broadcast, '192.168.1.1');
  assert.equal(r.firstHost, '192.168.1.1');
  assert.equal(r.lastHost, '192.168.1.1');
  assert.equal(r.totalHosts, 1);
  assert.equal(r.usableHosts, 1);
  assert.equal(r.subnetMask, '255.255.255.255');
  assert.equal(r.wildcardMask, '0.0.0.0');
});

test('IPv4: 192.168.1.0/31 - RFC 3021 two-address link', () => {
  const r = Subnet.calculateIPv4Subnet('192.168.1.0', 31);
  assert.equal(r.network, '192.168.1.0');
  assert.equal(r.broadcast, '192.168.1.1');
  assert.equal(r.firstHost, '192.168.1.0');
  assert.equal(r.lastHost, '192.168.1.1');
  assert.equal(r.totalHosts, 2);
  assert.equal(r.usableHosts, 2);
  assert.equal(r.subnetMask, '255.255.255.254');
});

test('IPv4: 192.168.1.100/26 - host address not on subnet boundary', () => {
  const r = Subnet.calculateIPv4Subnet('192.168.1.100', 26);
  assert.equal(r.network, '192.168.1.64');
  assert.equal(r.broadcast, '192.168.1.127');
  assert.equal(r.firstHost, '192.168.1.65');
  assert.equal(r.lastHost, '192.168.1.126');
  assert.equal(r.totalHosts, 64);
  assert.equal(r.usableHosts, 62);
  assert.equal(r.subnetMask, '255.255.255.192');
});

test('IPv4: accepts a dotted mask instead of a prefix', () => {
  const r = Subnet.calculateIPv4Subnet('172.16.5.10', { mask: '255.255.0.0' });
  assert.equal(r.cidr, 16);
  assert.equal(r.network, '172.16.0.0');
  assert.equal(r.broadcast, '172.16.255.255');
});

test('IPv4: binary representation is correct', () => {
  const r = Subnet.calculateIPv4Subnet('192.168.1.1', 24);
  assert.equal(r.ipBinary, '11000000.10101000.00000001.00000001');
});

test('IPv4: rejects an out-of-range octet', () => {
  assert.throws(() => Subnet.calculateIPv4Subnet('192.168.1.300', 24));
});

test('IPv4: rejects an address with too few octets', () => {
  assert.throws(() => Subnet.calculateIPv4Subnet('192.168.1', 24));
});

test('IPv4: rejects a non-numeric octet', () => {
  assert.throws(() => Subnet.calculateIPv4Subnet('192.168.1.abc', 24));
});

test('IPv4: rejects an out-of-range prefix', () => {
  assert.throws(() => Subnet.calculateIPv4Subnet('192.168.1.1', 33));
});

test('IPv4: rejects a non-contiguous subnet mask', () => {
  assert.throws(() => Subnet.maskToCidr('255.0.255.0'));
});

// ---------------------------------------------------------------------
// CIDR <-> dotted mask conversion, all 33 IPv4 prefix lengths (0-32)
// ---------------------------------------------------------------------

const MASK_TABLE = [
  '0.0.0.0', '128.0.0.0', '192.0.0.0', '224.0.0.0', '240.0.0.0',
  '248.0.0.0', '252.0.0.0', '254.0.0.0', '255.0.0.0', '255.128.0.0',
  '255.192.0.0', '255.224.0.0', '255.240.0.0', '255.248.0.0', '255.252.0.0',
  '255.254.0.0', '255.255.0.0', '255.255.128.0', '255.255.192.0', '255.255.224.0',
  '255.255.240.0', '255.255.248.0', '255.255.252.0', '255.255.254.0', '255.255.255.0',
  '255.255.255.128', '255.255.255.192', '255.255.255.224', '255.255.255.240', '255.255.255.248',
  '255.255.255.252', '255.255.255.254', '255.255.255.255'
];

test('CIDR -> mask and mask -> CIDR round-trip for all 33 prefixes (0-32)', () => {
  assert.equal(MASK_TABLE.length, 33);
  for (let prefix = 0; prefix <= 32; prefix++) {
    const expectedMask = MASK_TABLE[prefix];
    assert.equal(Subnet.cidrToMask(prefix), expectedMask, `prefix /${prefix} -> mask`);
    assert.equal(Subnet.maskToCidr(expectedMask), prefix, `mask ${expectedMask} -> prefix`);
  }
});

test('Wildcard mask is the bitwise inverse of the subnet mask', () => {
  assert.equal(Subnet.cidrToWildcard(24), '0.0.0.255');
  assert.equal(Subnet.cidrToWildcard(30), '0.0.0.3');
  assert.equal(Subnet.cidrToWildcard(0), '255.255.255.255');
  assert.equal(Subnet.cidrToWildcard(32), '0.0.0.0');
});

// ---------------------------------------------------------------------
// VLSM planner
// ---------------------------------------------------------------------

test('VLSM: block size is the smallest power of 2 covering hosts + net/broadcast', () => {
  assert.equal(Subnet.blockSizeForHosts(50), 64);
  assert.equal(Subnet.blockSizeForHosts(20), 32);
  assert.equal(Subnet.blockSizeForHosts(10), 16);
  assert.equal(Subnet.blockSizeForHosts(5), 8);
  assert.equal(Subnet.blockSizeForHosts(1), 4);
  assert.equal(Subnet.blockSizeForHosts(2), 4);
  assert.equal(Subnet.blockSizeForHosts(30), 32);
});

test('VLSM: 192.168.1.0/24 with [50, 20, 10, 5] allocates correctly', () => {
  const r = Subnet.calculateVLSM('192.168.1.0/24', [50, 20, 10, 5]);
  assert.equal(r.allocations.length, 4);

  // Requirement order is preserved in the output even though allocation
  // internally happens largest-block-first.
  const [a, b, c, d] = r.allocations;

  assert.equal(a.hostsRequested, 50);
  assert.equal(a.cidr, '192.168.1.0/26');
  assert.equal(a.network, '192.168.1.0');
  assert.equal(a.broadcast, '192.168.1.63');
  assert.equal(a.firstHost, '192.168.1.1');
  assert.equal(a.lastHost, '192.168.1.62');
  assert.equal(a.usableHosts, 62);

  assert.equal(b.hostsRequested, 20);
  assert.equal(b.cidr, '192.168.1.64/27');
  assert.equal(b.network, '192.168.1.64');
  assert.equal(b.broadcast, '192.168.1.95');
  assert.equal(b.usableHosts, 30);

  assert.equal(c.hostsRequested, 10);
  assert.equal(c.cidr, '192.168.1.96/28');
  assert.equal(c.network, '192.168.1.96');
  assert.equal(c.broadcast, '192.168.1.111');
  assert.equal(c.usableHosts, 14);

  assert.equal(d.hostsRequested, 5);
  assert.equal(d.cidr, '192.168.1.112/29');
  assert.equal(d.network, '192.168.1.112');
  assert.equal(d.broadcast, '192.168.1.119');
  assert.equal(d.usableHosts, 6);

  assert.equal(r.totalAddressesUsed, 120);
  assert.equal(r.totalAddressesAvailable, 256);
});

test('VLSM: allocated subnets do not overlap and stay within the base network', () => {
  const r = Subnet.calculateVLSM('10.0.0.0/22', [300, 100, 50, 50, 20, 10]);
  const ranges = r.allocations
    .map((a) => [a.networkInt, a.broadcastInt])
    .sort((x, y) => x[0] - y[0]);

  for (let i = 0; i < ranges.length; i++) {
    const [net, bcast] = ranges[i];
    assert.ok(bcast >= net);
    if (i > 0) {
      assert.ok(net > ranges[i - 1][1], 'subnet overlaps with previous allocation');
    }
  }

  const baseNet = Subnet.ipToInt('10.0.0.0');
  const baseLast = baseNet + Math.pow(2, 32 - 22) - 1;
  for (const [net, bcast] of ranges) {
    assert.ok(net >= baseNet && bcast <= baseLast, 'subnet escapes the base network');
  }
});

test('VLSM: each allocated block is correctly sized for its requirement', () => {
  const r = Subnet.calculateVLSM('192.168.0.0/24', [100, 40, 10, 2]);
  const byHosts = Object.fromEntries(r.allocations.map((a) => [a.hostsRequested, a]));
  assert.equal(byHosts[100].totalAddresses, 128); // needs 102 -> next pow2 is 128
  assert.equal(byHosts[40].totalAddresses, 64);   // needs 42 -> 64
  assert.equal(byHosts[10].totalAddresses, 16);   // needs 12 -> 16
  assert.equal(byHosts[2].totalAddresses, 4);     // needs 4 -> 4 (minimum /30 block)
});

test('VLSM: throws a clear error when requirements do not fit the base network', () => {
  assert.throws(
    () => Subnet.calculateVLSM('192.168.1.0/28', [50]),
    /do not fit|only provides/
  );
});

test('VLSM: throws when total of several small requirements exceeds the base network', () => {
  assert.throws(() => Subnet.calculateVLSM('192.168.1.0/24', [100, 100, 100]));
});

test('VLSM: rejects a non-CIDR base network string', () => {
  assert.throws(() => Subnet.calculateVLSM('192.168.1.0', [10]));
});

test('VLSM: rejects an empty requirements list', () => {
  assert.throws(() => Subnet.calculateVLSM('192.168.1.0/24', []));
});

// ---------------------------------------------------------------------
// IPv6 expand / compress - known examples and edge cases
// ---------------------------------------------------------------------

test('IPv6: "::1" expands to the loopback address', () => {
  assert.equal(Subnet.expandIPv6('::1'), '0000:0000:0000:0000:0000:0000:0000:0001');
});

test('IPv6: "::" expands to the unspecified address', () => {
  assert.equal(Subnet.expandIPv6('::'), '0000:0000:0000:0000:0000:0000:0000:0000');
});

test('IPv6: compressing the loopback and unspecified addresses round-trips', () => {
  assert.equal(Subnet.compressIPv6('0000:0000:0000:0000:0000:0000:0000:0001'), '::1');
  assert.equal(Subnet.compressIPv6('0000:0000:0000:0000:0000:0000:0000:0000'), '::');
});

test('IPv6: "2001:db8::1" expands and re-compresses back to itself', () => {
  assert.equal(Subnet.expandIPv6('2001:db8::1'), '2001:0db8:0000:0000:0000:0000:0000:0001');
  assert.equal(Subnet.compressIPv6('2001:db8::1'), '2001:db8::1');
});

test('IPv6: fully expanded address compresses a leading run of zeros', () => {
  assert.equal(
    Subnet.compressIPv6('2001:0db8:0000:0000:0000:0000:0000:0001'),
    '2001:db8::1'
  );
});

test('IPv6: double colon at the end of the address', () => {
  assert.equal(Subnet.expandIPv6('fe80::'), 'fe80:0000:0000:0000:0000:0000:0000:0000');
  assert.equal(Subnet.compressIPv6('fe80::'), 'fe80::');
});

test('IPv6: double colon in the middle of the address', () => {
  assert.equal(
    Subnet.expandIPv6('fe80::1234:5678'),
    'fe80:0000:0000:0000:0000:0000:1234:5678'
  );
  assert.equal(Subnet.compressIPv6('fe80::1234:5678'), 'fe80::1234:5678');
});

test('IPv6: tie between two equal-length zero runs compresses the leftmost (RFC 5952)', () => {
  // groups: 2001:db8:0:0:1:0:0:1 -> two runs of length 2, leftmost wins
  assert.equal(
    Subnet.compressIPv6('2001:0db8:0000:0000:0001:0000:0000:0001'),
    '2001:db8::1:0:0:1'
  );
});

test('IPv6: a lone single zero group is not compressed', () => {
  assert.equal(
    Subnet.compressIPv6('2001:0db8:0000:0001:0002:0003:0004:0005'),
    '2001:db8:0:1:2:3:4:5'
  );
});

test('IPv6: rejects an address with more than one "::"', () => {
  assert.throws(() => Subnet.expandIPv6('2001::db8::1'));
});

test('IPv6: rejects an address with the wrong number of groups', () => {
  assert.throws(() => Subnet.expandIPv6('2001:db8:1:2:3:4:5:6:7'));
  assert.throws(() => Subnet.expandIPv6('2001:db8:1:2'));
});

test('IPv6: rejects a group with invalid hex characters', () => {
  assert.throws(() => Subnet.expandIPv6('2001:zzzz::1'));
});

// ---------------------------------------------------------------------
// IPv6 subnet calculation (network prefix + total addresses via BigInt)
// ---------------------------------------------------------------------

test('IPv6: 2001:db8:85a3::8a2e:370:7334/32 resolves to the 2001:db8::/32 network', () => {
  const r = Subnet.calculateIPv6Subnet('2001:db8:85a3::8a2e:370:7334', 32);
  assert.equal(r.networkCompressed, '2001:db8::');
  assert.equal(r.network, '2001:0db8:0000:0000:0000:0000:0000:0000');
});

test('IPv6: /64 subnet contains 2^64 addresses', () => {
  const r = Subnet.calculateIPv6Subnet('2001:db8::', 64);
  assert.equal(r.totalAddresses, '18446744073709551616');
});

test('IPv6: /48 subnet (common site allocation) contains 2^80 addresses', () => {
  const r = Subnet.calculateIPv6Subnet('2001:db8::', 48);
  assert.equal(r.totalAddresses, '1208925819614629174706176');
});

test('IPv6: /128 subnet contains exactly 1 address', () => {
  const r = Subnet.calculateIPv6Subnet('::1', 128);
  assert.equal(r.totalAddresses, '1');
  assert.equal(r.network, r.expanded);
});

test('IPv6: /0 subnet contains the full 2^128 address space', () => {
  const r = Subnet.calculateIPv6Subnet('::', 0);
  assert.equal(r.totalAddresses, (2n ** 128n).toString());
  assert.equal(r.networkCompressed, '::');
});

test('IPv6: rejects an out-of-range prefix length', () => {
  assert.throws(() => Subnet.calculateIPv6Subnet('2001:db8::1', 129));
});
