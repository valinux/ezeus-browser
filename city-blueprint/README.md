# The Eight Estates — Zeus + Poseidon

Historical design for the original game. eZeus uses different housing rules; see [the source guide](../SOURCE_GUIDE.md). This layout has not been validated in the browser engine.

Open **[index.html](index.html)** in a browser. It is a self-contained, offline blueprint. Choose **Atlantis / Greece**, your difficulty, and one of the three districts. Click buildings for their exact coordinates and dependencies. Use the SVG, CSV, or Print/PDF controls to keep a copy beside the game.

## Recommended design

Build a **43 × 21 tile elite district with eight 4 × 4 homes**, served by one straight street and a Grand Agora. At Estate level it holds **160 elite residents**. Keep the two roadblocks and the boulevard verges exactly as drawn.

This is a compact service district for an operating city. Its complete support plan is:

| Module | Envelope | Capacity / purpose |
| --- | --- | --- |
| Elite district | 43 × 21 = 903 tiles | Eight Estates, up to 160 residents |
| Worker district | 38 × 14 = 532 tiles | Sixteen Townhouses, up to 960 residents |
| Shared yard | 33 × 16 = 528 tiles | Trainers, Granary, Storehouses, Palace and maintenance |
| Total drawn envelopes | 1,963 tiles | Plus connections, terrain clearance, production and trade |

The three modules use **320 service workers in Atlantis or 305 in Greece**, including the optional watchposts, before farms, industry, ranches and trade. Common-house population is not the same as available workers. Expand common housing if the employment panel shows a shortage.

## Copy the elite street

Coordinates are one-based, measured from the upper-left corner of the 43 × 21 rectangle.

1. Lay a horizontal road from **column 1 to 43, row 11**.
2. Put roadblocks at **(2, 11)** and **(42, 11)**. Connect column 43 to the city road. Put all junctions beyond the roadblocks.
3. Build the Grand Agora over **columns 36–41, rows 9–13**, with its central road on row 11. Build all six stalls in the shown slots.
4. Upgrade road columns **11–29** to a boulevard. Keep **rows 10 and 12** clear for its two planted verges.
5. Build the ponds and all green park squares. The eight rear 4 × 4 ponds begin at columns **11, 16, 21, 26**, on rows **2 and 17**.
6. Staff the local services and their trainers in the shared yard. Open the appropriate four culture/science service types.
7. Place eight elite homes with upper-left corners at columns **11, 16, 21, 26**, on rows **6 and 13**. These touch the boulevard verges and receive road access through them.
8. Maintain supplies and check each house’s explanation until it becomes an Estate. Verify beauty and service freshness in the actual game.

## The upgrade sequence

Common housing never turns into elite housing. The highest common level is Townhouse. Place separate elite plots after the common city can support them.

At **Hero** difficulty:

| Elite level | New requirement, in addition to previous goods | Culture/science | Entry appeal | Capacity |
| --- | --- | --- | --- | --- |
| Residence | Food, fleece, olive oil | 50 | 50 | 6 |
| Mansion | Armor | 60 | 60 | 10 |
| Manor | Wine | 70 | 70 | 16 |
| Estate | Horses in Greece / chariots in Atlantis; working Stadium / Museum | 80 | 80 | 20 |

For eight initial plots, keep **16 food, 8 fleece and 8 olive oil** available for placement, plus ongoing supply. Use the HTML difficulty selector for other difficulties: Beginner’s Estate score is 70; Olympian’s Estate entry appeal is 85.

Elite houses supply their own water. The **Fountain belongs in the common block**. Both districts include an Infirmary and Maintenance Office. A pond is decoration, not a drinking-water source. A Watchpost and Tax Office are useful civic facilities, not upgrade requirements.

## Civilization-specific services

| Purpose | Atlantis | Greece |
| --- | --- | --- |
| First local service | Bibliotheke → scholars | College → Podium → philosophers |
| Second local service | University → Observatory → astronomers | Gymnasium → athletes |
| Third local service | Inventors’ Workshop → Laboratory → inventors | Drama School → Theater → actors |
| Final elite service | University → Museum → curators | Gymnasium → Stadium → competitors |
| Final mount supply | Wheat-fed Horse Ranch + wood → Chariot Factory → Chariot stall | Wheat-fed Horse Ranch → Agora Horse Trainer |

There is only **one Museum or Stadium per city**. This plan places it in the elite district. If it is already elsewhere, its specialist route must be adapted. Do not duplicate this module unchanged across the map.

Horse Ranches need **wheat** from a farm, Storehouse or importing trade facility; they do not take it directly from a Granary. Food vendors do not use wheat stored in a Storehouse. Chariots must be manufactured locally and cannot be imported/exported.

## Files you can copy

- [Interactive standalone HTML](index.html)
- [Printable guide PDF](Blueprint-Poseidon.pdf)
- [Atlantis elite map, PNG](poseidon-elite.png) / [SVG](poseidon-elite.svg)
- [Greek elite map, PNG](zeus-elite.png) / [SVG](zeus-elite.svg)
- [Atlantis elite coordinates](poseidon-elite.csv) / [Greek elite coordinates](zeus-elite.csv)
- Worker and support SVG/CSV files follow the same naming convention.
- [Full design data](blueprint.json), [research](research.md), [geometry validation](validation.json), [browser validation](browser-validation.json)

## Verification and remaining check

The generator reads all five installed difficulty models. Geometry validation checks all six district/civilization combinations for bounds, overlaps, road frontage, reserved boulevard space, connected service roads, and provider-to-house road distances. Browser checks exercise both civilizations, all three districts, all five difficulties, the inspector, controls, local checklist, exports and mobile layout.

**The city has not been built and observed in-game.** The final desirability field and recurring walker delivery are not simulated by the blueprint. Build the complete beauty reserves, read the house messages, and observe a full game year with trainer service/goods boosts off. If beauty needs a boost, strengthen the rear decorative plots or extend their buffer without changing the street. Scenario building availability and map resources may require adaptations.

This is a practical compact recommendation, not a proof of the smallest possible city. No game rules, trainer settings or saved games were changed.

To rebuild after changing the source template or design:

```sh
python3 city-blueprint/build.py --game-root "/path/to/Zeus + Poseidon"
python3 city-blueprint/validate.py
```

These commands run from the repository root. Original game models and executable are read locally and are not distributed. `check-browser.mjs` additionally requires an isolated Chromium-compatible browser with local debugging enabled on port 9337.
