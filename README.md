# Subnetter

A fast, client-side IPv4/IPv6 subnet calculator, VLSM planner, and CIDR/mask
converter. Plain HTML, CSS, and vanilla JavaScript. No framework, no build
step, no server. Every calculation runs locally in the browser.

## Features

### IPv4 Subnet Calculator
Enter an IP address and a CIDR prefix (or a dotted subnet mask) to get the
network address, broadcast address, first/last usable host, total and usable
host counts, subnet mask, wildcard mask, and the address in binary.

**Example:** `192.168.1.10` / `24`
- Network: `192.168.1.0`
- Broadcast: `192.168.1.255`
- Usable range: `192.168.1.1` – `192.168.1.254`
- Usable hosts: `254`
- Mask: `255.255.255.0` &nbsp; Wildcard: `0.0.0.255`

### VLSM Planner
Enter a base network (e.g. `192.168.1.0/24`) and a comma-separated list of
required host counts (e.g. `50, 20, 10, 5`). Each requirement is sized to the
smallest power-of-two block that fits it, subnets are allocated largest-first
so nothing overlaps, and the tool errors clearly if the requirements don't
fit in the base network.

**Example:** `192.168.1.0/24` with `50, 20, 10, 5` hosts produces:

| Hosts Needed | Subnet | Usable Range | Usable Hosts |
|---|---|---|---|
| 50 | `192.168.1.0/26` | `.1` – `.62` | 62 |
| 20 | `192.168.1.64/27` | `.65` – `.94` | 30 |
| 10 | `192.168.1.96/28` | `.97` – `.110` | 14 |
| 5 | `192.168.1.112/29` | `.113` – `.118` | 6 |

### IPv6 Subnet Calculator
Enter an IPv6 address (compressed or expanded) and a prefix length (0–128)
to get the expanded form, the RFC 5952 compressed form, the network prefix,
and the total number of addresses in the subnet — computed with `BigInt`
since IPv6 host counts exceed JavaScript's safe integer range.

**Example:** `2001:db8:85a3::8a2e:370:7334` / `32`
- Network: `2001:db8::/32`
- Total addresses: `79228162514264337593543950336` (2^96)

### CIDR ↔ Subnet Mask Converter
A quick-reference, two-way converter between CIDR prefix length and dotted
subnet mask, plus a full table for every prefix from `/0` to `/32`.

## How to Use

Just open `index.html` in a browser — there's nothing to install or build.

Or view the live demo: _add your GitHub Pages link here after deploying_.

To deploy it yourself: push this repository to GitHub, then enable GitHub
Pages for the repository (Settings → Pages → deploy from the `main` branch).

## Running Tests

The calculation logic in `subnet.js` is fully unit tested with Node's
built-in test runner.

```bash
npm test
```

This runs `node --test tests/*.test.js`, covering:
- IPv4 subnet math against hand-verified examples (`/24`, `/8`, a `/30`
  point-to-point link, a `/32` host route, a `/31` two-address link, and
  non-boundary-aligned hosts)
- VLSM allocation correctness — no overlaps, correct block sizing, staying
  within the base network, and clear errors when requirements don't fit
- IPv6 expand/compress correctness, including `::1`, `::`, and addresses
  with `::` in different positions
- CIDR/mask conversion in both directions for all 33 IPv4 prefix lengths
  (`/0` through `/32`)

Continuous integration (`.github/workflows/ci.yml`) runs the same suite on
every push and pull request.

## Project Structure

```
subnetter/
├── index.html              # markup for all four tools
├── style.css                # dark theme styling
├── subnet.js                 # pure calculation logic (browser + Node)
├── app.js                    # DOM wiring / event handlers only
├── tests/
│   └── subnet.test.js         # node --test suite
├── .github/workflows/ci.yml   # CI: runs npm test on push/PR
├── package.json
├── LICENSE
└── README.md
```

`subnet.js` contains no DOM code at all — every function is a pure input-to-
output calculation, exported both to `window.Subnet` for the browser and via
`module.exports` for Node, so the exact same code that powers the UI is what
the test suite verifies.

## Author

Hanaan Mir
