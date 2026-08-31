/* ============================================================
   HALDANE FISHER — MODULAR · PRICING CONFIGURATION
   ============================================================
   This is the ONLY file you need to edit to change how quotes
   are calculated. Every price in the app is driven from here:

   · Timber       — £ per cubic metre for each section
   · Cladding     — £ per m² of wall area
   · Glazing      — £ per unit (UK standard sizes)
   · Roof / floor — £ per m² materials
   · Decking      — £ per m² of deck area
   · Heating      — £ per m² of floor area
   · Labour       — £ per m² of floor area
   · Margin       — % added on top of (materials + labour)
   · Waste        — % extra timber allowed for cutting waste

   How the quote is built (see calculatePrice() in index.html):
   1. The structural cutting list is generated from the customer's
      configuration (studs, plates, headers, joists, trusses...).
   2. Timber is costed by VOLUME: linear metres × section area
      × £/m³, plus the waste allowance.
   3. All other materials are costed by area or per unit.
   4. Labour, then the margin, are added on top.

   NOTE: if you change a glazing price here, also update the
   price shown on its option card in index.html (search for the
   £ amount, e.g. "£1,850").
   ============================================================ */

window.PRICING = {

  /* ---------- General ---------- */

  businessName: 'Haldane Fisher — Modular',
  currency: '£',
  vatNote: 'All prices exclude VAT. Base / foundation excluded.',
  marginPct: 25,      // % added on top of (materials + labour)
  wastePct: 10,       // % extra timber allowed for cutting waste

  /* ---------- Timber (price per cubic metre) ---------- */
  /* section size: width x depth in mm, grade shown on drawings */

  timber: {
    stud:  { size: '72 x 35mm', grade: 'C16', pricePerCbm: 340 },  // wall framing
    joist: { size: '97 x 35mm', grade: 'C16', pricePerCbm: 360 }   // floor & roof
  },

  /* ---------- Cladding (£ per m² of wall area) ---------- */

  cladding: {
    cedar:     42,   // Natural Western Red Cedar — vertical slatted
    oak:       54,   // Warm Honey Oak — premium treated vertical
    composite: 77,   // Anthracite Composite Slats
    render:    67    // Crisp White Silicone Render
  },

  /* ---------- Glazing (£ per unit) ---------- */
  /* Key must match the opening type id used in index.html */

  openings: {
    'bifold-180':        1850,
    'bifold-240':        2100,
    'bifold-wide':       2450,
    'bifold-360':        3100,
    'sliding-180':       1550,
    'sliding-210':       1750,
    'sliding-240':       1950,
    'french-150':        1280,
    'french-180':        1420,
    'single-door':        780,
    'window-high-120':    480,
    'window-high-180':    580,
    'window-casement-60': 390,
    'window-casement-120':510,
    'window-tall-60':     490,
    'window-tall-80':     590
  },

  /* ---------- Wall build-up (£ per m² of net wall area) ---------- */

  wallSheathing: 7,       // 11mm OSB exterior sheathing
  wallInsulation: 12.5,   // 70mm PIR insulation
  wallLining: 7,          // internal lining / plasterboard

  /* ---------- Roof (£ per m² of roof deck area) ---------- */

  roofDeck: 9.5,          // 18mm OSB deck
  roofCovering: 24,       // single-ply EPDM membrane
  roofInsulation: 15,     // 100mm PIR insulation

  /* ---------- Floor (£ per m² of floor area) ---------- */

  floorDeck: 13,          // 22mm T&G floor deck
  floorInsulation: 15,    // 100mm PIR insulation

  /* ---------- Extras ---------- */

  deckingPerSqm: 95,      // front composite decking platform
  heatingPerSqm: 45,      // electric foil underfloor heating
  sundriesPerSqm: 15,     // fixings, membranes, trims allowance

  /* ---------- Labour (£ per m² of floor area) ---------- */

  labourPerSqm: 280
};
