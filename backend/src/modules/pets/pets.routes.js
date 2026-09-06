import { Router } from 'express';
import { z } from 'zod';
import { many, one, withTransaction } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { requireCustomer } from '../../middleware/appUser.js';

const router = Router();
router.use(requireCustomer);

const SELECT_PET = `
  SELECT id, code, customer_id, name, breed, weight, care_note, age, dob, sex, size,
         neutered, coat, temperament, allergies, vaccinated, next_vaccine,
         microchip, vet, vet_clinic, vet_phone, art
  FROM pets
`;

/* GET /api/app/pets */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const pets = await many(`${SELECT_PET} WHERE customer_id = $1 ORDER BY id`, [req.app_user.id]);
    res.json({ pets });
  })
);

/* GET /api/app/pets/:id — the whole record: health, vaccines, grooming history. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const pet = await one(
      `${SELECT_PET} WHERE id = $1 AND customer_id = $2`,
      [req.params.id, req.app_user.id]
    );
    if (!pet) throw httpError(404, 'No pet with that ID on your account.');

    const vaccines = await many(
      'SELECT name, given_on, due_on, up_to_date FROM pet_vaccines WHERE pet_id = $1 ORDER BY sort',
      [pet.id]
    );
    const history = await many(
      `SELECT v.code, v.visited_on, v.rating, v.mins, v.note,
              p.name AS package_name, pa.name AS partner_name
       FROM pet_visits v
       LEFT JOIN packages p ON p.id = v.package_id
       LEFT JOIN partners pa ON pa.id = v.partner_id
       WHERE v.pet_id = $1 ORDER BY v.sort`,
      [pet.id]
    );

    res.json({ pet, vaccines, history });
  })
);

/* GET /api/app/pets/:id/visits/:code — a single past visit with its photos. */
router.get(
  '/:id/visits/:code',
  asyncHandler(async (req, res) => {
    const visit = await one(
      `SELECT v.code, v.visited_on, v.rating, v.mins, v.note,
              p.name AS package_name, pa.name AS partner_name, pa.id AS partner_id
       FROM pet_visits v
       LEFT JOIN packages p ON p.id = v.package_id
       LEFT JOIN partners pa ON pa.id = v.partner_id
       JOIN pets pet ON pet.id = v.pet_id
       WHERE v.code = $1 AND v.pet_id = $2 AND pet.customer_id = $3`,
      [req.params.code, req.params.id, req.app_user.id]
    );
    if (!visit) throw httpError(404, 'No such visit.');
    res.json({ visit });
  })
);

const petBody = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  breed: z.string().trim().min(1, 'Pick a breed'),
  weight: z.string().trim().optional().default(''),
  age: z.string().trim().optional().default(''),
  sex: z.string().trim().optional().default(''),
  size: z.string().trim().optional().default(''),
  neutered: z.string().trim().optional().default(''),
  coat: z.string().trim().optional().default(''),
  temperament: z.string().trim().optional().default(''),
  allergies: z.string().trim().optional().default(''),
  careNote: z.string().trim().optional().default('')
});

/* Portrait colours for a new pet, cycling the palette the prototype used. */
const ART_PRESETS = [
  { bg1: '#E9CBA0', bg2: '#C2914F', coat: '#F5E7D6', coatDark: '#C68B4A', ear: 'drop', ear2: '#8B4E22', muzzle: '#FFF7EC' },
  { bg1: '#F2DAC3', bg2: '#D8A87E', coat: '#FFF6EA', coatDark: '#D8B58E', ear: 'fluff', ear2: '#DDB98F', muzzle: '#FFFCF6' },
  { bg1: '#DCB78E', bg2: '#A9703C', coat: '#E5BC88', coatDark: '#A97230', ear: 'prick', ear2: '#C9954F', muzzle: '#F8E2C6' }
];

router.post(
  '/',
  validate(petBody),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const created = await withTransaction(async (c) => {
      const { rows: countRows } = await c.query(
        'SELECT count(*)::int AS n FROM pets WHERE customer_id = $1', [req.app_user.id]
      );
      const art = { ...ART_PRESETS[countRows[0].n % ART_PRESETS.length], id: b.name.toLowerCase() };

      const { rows } = await c.query(
        `INSERT INTO pets (customer_id, name, breed, weight, age, sex, size, neutered,
                           coat, temperament, allergies, care_note, vaccinated, art)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Not recorded',$13) RETURNING *`,
        [req.app_user.id, b.name, b.breed, b.weight || null, b.age || null, b.sex || null,
         b.size || null, b.neutered || null, b.coat || null, b.temperament || null,
         b.allergies || null, b.careNote || null, JSON.stringify(art)]
      );
      return rows[0];
    });
    res.status(201).json({ pet: created });
  })
);

router.patch(
  '/:id',
  validate(petBody.partial()),
  asyncHandler(async (req, res) => {
    const map = {
      name: 'name', breed: 'breed', weight: 'weight', age: 'age', sex: 'sex', size: 'size',
      neutered: 'neutered', coat: 'coat', temperament: 'temperament',
      allergies: 'allergies', careNote: 'care_note'
    };
    const fields = Object.entries(req.body).filter(([k]) => map[k]);
    if (!fields.length) throw httpError(400, 'Nothing to update.');

    const set = fields.map(([k], i) => `${map[k]} = $${i + 3}`).join(', ');
    const pet = await one(
      `UPDATE pets SET ${set} WHERE id = $1 AND customer_id = $2 RETURNING *`,
      [req.params.id, req.app_user.id, ...fields.map(([, v]) => v)]
    );
    if (!pet) throw httpError(404, 'No pet with that ID on your account.');

    /* A care note edited here has to reach the partner's job sheet. Upcoming
       bookings carry their own copy, so they are refreshed too — this is the
       through-line the whole product is built around. */
    if (req.body.careNote !== undefined) {
      await one(
        `UPDATE bookings SET care_note = $2
         WHERE pet_id = $1 AND status NOT IN ('Completed','Cancelled') RETURNING id`,
        [pet.id, pet.care_note]
      );
    }

    res.json({ pet });
  })
);

router.get(
  '/meta/breeds',
  asyncHandler(async (_req, res) => {
    const breeds = await many('SELECT name FROM breeds ORDER BY sort');
    res.json({ breeds: breeds.map((b) => b.name) });
  })
);

export default router;
