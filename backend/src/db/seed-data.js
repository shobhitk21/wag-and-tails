/* ============================================================
   Seed data — ported verbatim from the prototype's js/data.js and
   js/data-store.js. Package names, inclusion lists, MRPs, live prices and
   add-on prices are the client's own figures and must not be edited here.
   Walk pricing is provisional and flagged as such in the admin catalogue.
   ============================================================ */

export const STAFF_USERS = [
  { code: 's1', name: 'Nikhil Raut',    email: 'nikhil@wagandtails.in', role: 'bookings_staff', shift: '9 am – 6 pm',  active: true,  handled: 34, art: ['#F07B2C', '#A8480C'] },
  { code: 's2', name: 'Anjali Desai',   email: 'anjali@wagandtails.in', role: 'bookings_staff', shift: '12 pm – 9 pm', active: true,  handled: 41, art: ['#1F5F8B', '#0D3350'] },
  { code: 's3', name: 'Faizan Qureshi', email: 'faizan@wagandtails.in', role: 'support',        shift: '9 am – 6 pm',  active: false, handled: 19, art: ['#1F7A4D', '#0E4229'] },
  { code: 'a1', name: 'Sarthak Kulkarni', email: 'admin@wagandtails.in', role: 'super_admin',   shift: '—',            active: true,  handled: 0,  art: ['#4A1E0B', '#2B1206'] }
];

export const CUSTOMERS = [
  { id: 'C1041', name: 'Aarav Mehta',    phone: '+91 98204 11233', pets: 3, bookings: 9, spend: 14280, since: 'Jan 2025', area: 'Andheri West' },
  { id: 'C1088', name: 'Priya Nair',     phone: '+91 98191 55402', pets: 1, bookings: 4, spend: 6890,  since: 'Mar 2025', area: 'Versova' },
  { id: 'C1120', name: 'Devika Rao',     phone: '+91 99872 30117', pets: 2, bookings: 6, spend: 9120,  since: 'Jun 2025', area: 'Juhu' },
  { id: 'C1156', name: 'Ishaan Gupta',   phone: '+91 98330 71265', pets: 1, bookings: 2, spend: 2180,  since: 'Nov 2025', area: 'Malad West' },
  { id: 'C1203', name: 'Farah Sheikh',   phone: '+91 98675 20914', pets: 1, bookings: 3, spend: 5490,  since: 'Feb 2026', area: 'Bandra West' },
  { id: 'C1240', name: 'Meera Kulkarni', phone: '+91 98191 44027', pets: 1, bookings: 0, spend: 0,     since: 'Today',    area: 'Bandra West' }
];

export const PARTNERS = [
  { id: 'P21', name: 'Ritika Sharma', kind: 'Groomer', rating: 4.9, jobs: 412, area: 'Andheri West', status: 'Active',  docs: 'Verified',     payout: 11620, phone: '+91 98670 22110', account: 'HDFC ••3391' },
  { id: 'P34', name: 'Aman Verma',    kind: 'Groomer', rating: 4.7, jobs: 288, area: 'Malad West',   status: 'Active',  docs: 'Verified',     payout: 8740,  phone: '+91 98670 55231', account: 'HDFC ••3391' },
  { id: 'P52', name: 'Neha Pillai',   kind: 'Walker',  rating: 4.8, jobs: 530, area: 'Andheri West', status: 'Active',  docs: 'Verified',     payout: 4890,  phone: '+91 99201 33418', account: 'UPI' },
  { id: 'P61', name: 'Karan Joshi',   kind: 'Walker',  rating: 4.9, jobs: 341, area: 'Bandra West',  status: 'Active',  docs: 'Renewal due',  payout: 3620,  phone: '+91 99201 77052', account: 'UPI' },
  { id: 'P77', name: 'Sana Kapoor',   kind: 'Groomer', rating: 0,   jobs: 0,   area: 'Powai',        status: 'Pending', docs: 'Under review', payout: 0,     phone: '+91 98201 66104', account: null }
];

export const PARTNER_DOCUMENTS = [
  { name: 'Government ID',          detail: 'Aadhaar · verified 12 Jan 2026',        ok: true },
  { name: 'Address proof',          detail: 'Verified 12 Jan 2026',                  ok: true },
  { name: 'Grooming certification', detail: 'Pet Grooming Institute, 2023',          ok: true },
  { name: 'Police verification',    detail: 'Renewal due 30 Sep 2026',               ok: false }
];

/* Care notes are the through-line: this sentence is what the groomer's job
   sheet, the walker's request and the staff booking form all render. */
export const PETS = [
  { code: 'simba', customer: 'C1041', name: 'Simba', breed: 'Beagle',           weight: '12 kg', careNote: 'Hates having his ears touched, go slow.' },
  { code: 'mochi', customer: 'C1088', name: 'Mochi', breed: 'Shih Tzu',         weight: '5 kg',  careNote: 'Mats behind the ears, needs de-matting.' },
  { code: 'rio',   customer: 'C1120', name: 'Rio',   breed: 'Indie',            weight: '18 kg', careNote: 'Pulls hard for the first five minutes, then settles.' },
  { code: 'bruno', customer: 'C1120', name: 'Bruno', breed: 'Labrador',         weight: '28 kg', careNote: 'Nervous around clippers — introduce them slowly.' },
  { code: 'coco',  customer: 'C1203', name: 'Coco',  breed: 'Golden Retriever', weight: '24 kg', careNote: 'Loves the dryer. Check between the toes for ticks.' }
];

export const PACKAGES = [
  { id: 'basic', name: 'Basic', mrp: 1200, price: 999, mins: 60, blurb: 'Bath, dry and the essentials', incl: [
    'Bath with shampoo', 'Blow dry', 'Nail clipping', 'Ear clean', 'Eye clean',
    'Paw massage', 'Paw cream', 'Fragrance', 'Combing/brushing'] },
  { id: 'bathbasic', name: 'Bath + Basic', mrp: 1800, price: 1299, mins: 75, blurb: 'Adds a face trim and dental care', incl: [
    'Bath with shampoo', 'Blow dry', 'Face haircutting', 'Sanitary trim', 'Nail clipping',
    'Ear cleaning', 'Eye cleaning', 'Teeth cleaning', 'Mouth spray', 'Paw massage', 'Combing/brushing'] },
  { id: 'standard', name: 'Standard', mrp: 1800, price: 1399, mins: 70, blurb: 'A full body trim, no bath', incl: [
    'Full body trimming', 'Ear cleaning', 'Eye cleaning', 'Nail clipping'] },
  { id: 'premium', name: 'Premium', mrp: 2499, price: 1699, mins: 90, popular: true, blurb: 'Our most booked — wash, trim and style', incl: [
    'Bath with shampoo & conditioner', 'Blow dry', 'Full body hair trimming/styling', 'Ear & eye cleaning',
    'Paw cream & massage', 'Sanitary clipping', 'Nail clipping', 'Teeth cleaning', 'Mouth spray',
    'Fragrance', 'Combing/brushing'] },
  { id: 'luxury', name: 'Luxury', mrp: 3000, price: 2199, mins: 120, blurb: 'Everything, plus tick and mat treatment', incl: [
    'Bath with shampoo & conditioner', 'Blow dry', 'Hair styling', 'De-matting', 'Tick removal by hand',
    'Anti-tick treatment', 'Eye cleaning', 'Ear cleaning', 'Body massage', 'Sanitary clipping',
    'Nail clipping', 'Teeth cleaning/mouth spray', 'Paw massage', 'Combing/brushing'] }
];

export const ADDONS = [
  { id: 'tick',    name: 'Tick removal by hand', price: 300, note: 'Manual, no chemicals',      attachRate: 31 },
  { id: 'demat',   name: 'De-matting',           price: 300, note: 'For coats with knots',      attachRate: 24 },
  { id: 'medbath', name: 'Medicated bath',       price: 300, note: 'Vet-recommended shampoo',   attachRate: 18 },
  { id: 'bath',    name: 'Normal bath',          price: 200, note: 'Extra rinse and dry',       attachRate: 12 }
];

/* PROVISIONAL — pending a route and payout study. */
export const WALK_DURATIONS = [
  { id: 'w30', mins: 30, price: 249, note: 'A quick loop of the block',     km: '1.5–2 km' },
  { id: 'w45', mins: 45, price: 349, note: 'Neighbourhood plus the park',   km: '2.5–3.5 km' },
  { id: 'w60', mins: 60, price: 449, note: 'Long walk with a play stop',    km: '4–5 km' }
];

export const PRODUCT_CATEGORIES = [
  { id: 'grooming', name: 'Grooming',      icon: 'scissors' },
  { id: 'food',     name: 'Food & treats', icon: 'bag' },
  { id: 'health',   name: 'Health',        icon: 'heart' },
  { id: 'gear',     name: 'Walk gear',     icon: 'route' },
  { id: 'toys',     name: 'Toys',          icon: 'paw' }
];

export const PRODUCTS = [
  { id: 'p1', name: 'Oatmeal & Neem Shampoo', cat: 'grooming', art: 'bottle', tone: 0,
    mrp: 649, price: 499, trade: 374, rating: 4.7, reviews: 412, sizes: ['200 ml', '500 ml', '1 L'], size: 1,
    tag: 'Bestseller', stock: 'In stock',
    desc: 'A mild, soap-free shampoo for weekly washes. Oatmeal calms itchy skin and neem keeps ticks at bay without stripping the coat.',
    bullets: ['Soap and paraben free', 'Safe for puppies over 8 weeks', 'pH balanced for dogs'],
    ingredients: 'Oatmeal, neem, aloe vera, coconut-derived cleansers' },
  { id: 'p2', name: 'Tick & Flea Shampoo', cat: 'grooming', art: 'bottle', tone: 1,
    mrp: 749, price: 599, trade: 449, rating: 4.6, reviews: 268, sizes: ['200 ml', '500 ml'], size: 1,
    stock: 'In stock',
    desc: 'A medicated wash for active tick season. Use alongside a hand tick removal for a heavy infestation.',
    bullets: ['Kills ticks and fleas on contact', 'Vet formulated', 'Follow with a conditioner'],
    ingredients: 'Permethrin 0.5%, citronella, aloe' },
  { id: 'p3', name: 'Conditioning Coat Spray', cat: 'grooming', art: 'spray', tone: 2,
    mrp: 549, price: 429, trade: 322, rating: 4.5, reviews: 154, sizes: ['200 ml'], size: 0,
    stock: 'In stock',
    desc: 'A leave-in detangler for long coats. Spray before brushing to stop mats forming behind the ears.',
    bullets: ['Leave-in, no rinsing', 'Light coconut scent', 'Good for Shih Tzus and Spaniels'],
    ingredients: 'Argan oil, coconut oil, vitamin E' },
  { id: 'p4', name: 'Slicker Brush', cat: 'grooming', art: 'brush', tone: 3,
    mrp: 799, price: 599, trade: 449, rating: 4.8, reviews: 521, sizes: ['Small', 'Medium', 'Large'], size: 1,
    tag: 'Bestseller', stock: 'In stock',
    desc: 'Fine bent pins that lift loose undercoat without scratching skin. The one brush most coats need.',
    bullets: ['Bent stainless pins', 'Non-slip handle', 'Weekly use for double coats'],
    ingredients: '' },
  { id: 'p5', name: 'De-matting Comb', cat: 'grooming', art: 'comb', tone: 0,
    mrp: 649, price: 499, trade: 374, rating: 4.6, reviews: 198, sizes: ['Standard'], size: 0,
    stock: 'Low stock',
    desc: 'Serrated blades that cut through knots rather than pulling them. Work in small sections, always away from the skin.',
    bullets: ['9 serrated blades', 'Safety-rounded tips', 'For mats behind ears and legs'],
    ingredients: '' },
  { id: 'p6', name: 'Nail Clipper with Guard', cat: 'grooming', art: 'clipper', tone: 1,
    mrp: 549, price: 399, trade: 299, rating: 4.4, reviews: 307, sizes: ['Small', 'Large'], size: 0,
    stock: 'In stock',
    desc: 'A quick-stop guard so you cannot cut past the quick. Includes a small file on the handle.',
    bullets: ['Safety guard', 'Built-in file', 'Stainless steel blades'],
    ingredients: '' },
  { id: 'p7', name: 'Paw Butter', cat: 'grooming', art: 'tub', tone: 2,
    mrp: 449, price: 349, trade: 262, rating: 4.9, reviews: 634, sizes: ['50 g', '100 g'], size: 1,
    tag: 'Top rated', stock: 'In stock',
    desc: 'For pads cracked by hot pavement or monsoon damp. Massage in at night — it absorbs before they lick it off.',
    bullets: ['100% natural', 'Safe if licked', 'Also good for dry noses'],
    ingredients: 'Shea butter, beeswax, coconut oil, vitamin E' },
  { id: 'p8', name: 'Ear Cleaning Solution', cat: 'health', art: 'bottle', tone: 3,
    mrp: 399, price: 299, trade: 224, rating: 4.5, reviews: 221, sizes: ['100 ml'], size: 0,
    stock: 'In stock',
    desc: 'A gentle flush for floppy-eared breeds that trap moisture. Use fortnightly, never a cotton bud.',
    bullets: ['Alcohol free', 'For Beagles, Spaniels, Bassets', 'Fortnightly use'],
    ingredients: 'Salicylic acid, aloe, witch hazel' },
  { id: 'p9', name: 'Dental Kit', cat: 'health', art: 'kit', tone: 0,
    mrp: 599, price: 449, trade: 337, rating: 4.3, reviews: 176, sizes: ['Brush + paste'], size: 0,
    stock: 'In stock',
    desc: 'Enzymatic paste with a dual-head brush and a finger brush for dogs who will not tolerate a handle yet.',
    bullets: ['Chicken-free formula', 'Do not use human toothpaste', 'Three times a week'],
    ingredients: 'Enzymatic paste, mint-free' },
  { id: 'p10', name: 'No-Pull Harness', cat: 'gear', art: 'harness', tone: 1,
    mrp: 1299, price: 999, trade: 749, rating: 4.8, reviews: 889, sizes: ['S', 'M', 'L', 'XL'], size: 2,
    tag: 'Bestseller', stock: 'In stock',
    desc: 'Front-clip harness that turns a puller sideways instead of letting them lean into the collar. What our walkers use.',
    bullets: ['Front and back clip', 'Padded chest plate', 'Reflective stitching'],
    ingredients: '' },
  { id: 'p11', name: 'Reflective Leash 5 ft', cat: 'gear', art: 'leash', tone: 2,
    mrp: 899, price: 699, trade: 524, rating: 4.7, reviews: 342, sizes: ['5 ft', '8 ft'], size: 0,
    stock: 'In stock',
    desc: 'Woven reflective thread through the whole length, with a padded loop for evening walks.',
    bullets: ['Reflective in headlights', 'Padded handle', 'Rust-proof clasp'],
    ingredients: '' },
  { id: 'p12', name: 'Lamb & Oats Kibble', cat: 'food', art: 'bag', tone: 3,
    mrp: 2099, price: 1749, trade: 1312, rating: 4.6, reviews: 456, sizes: ['1.5 kg', '3 kg', '7 kg'], size: 1,
    stock: 'In stock',
    desc: 'A single-protein recipe for dogs who react to chicken. Grain-inclusive with oats rather than wheat.',
    bullets: ['No chicken', 'No wheat or soy', 'For adults 1 year and over'],
    ingredients: 'Lamb, oats, barley, flaxseed, beet pulp', contains: ['lamb'] },
  { id: 'p13', name: 'Chicken & Rice Kibble', cat: 'food', art: 'bag', tone: 0,
    mrp: 1899, price: 1599, trade: 1199, rating: 4.5, reviews: 612, sizes: ['1.5 kg', '3 kg', '7 kg'], size: 1,
    stock: 'In stock',
    desc: 'An everyday adult recipe with rice as the carbohydrate. Our most popular bag.',
    bullets: ['Real chicken first', 'Added omega 3', 'For adults 1 year and over'],
    ingredients: 'Chicken, rice, chicken fat, flaxseed', contains: ['chicken'] },
  { id: 'p14', name: 'Dental Chew Sticks', cat: 'food', art: 'chew', tone: 1,
    mrp: 549, price: 399, trade: 299, rating: 4.7, reviews: 398, sizes: ['Pack of 7', 'Pack of 20'], size: 1,
    stock: 'In stock',
    desc: 'A ridged chew that scrapes plaque while they work at it. One a day, after the evening meal.',
    bullets: ['Grain free', 'Under 90 calories each', 'Vegetarian'],
    ingredients: 'Potato starch, glycerin, chlorophyll, parsley' },
  { id: 'p15', name: 'Rope Tug Toy', cat: 'toys', art: 'rope', tone: 2,
    mrp: 449, price: 329, trade: 247, rating: 4.4, reviews: 210, sizes: ['Medium', 'Large'], size: 0,
    stock: 'In stock',
    desc: 'Undyed cotton rope with three knots. Doubles as floss for dogs who like to chew.',
    bullets: ['Undyed cotton', 'Machine washable', 'Not for unsupervised chewing'],
    ingredients: '' },
  { id: 'p16', name: 'Squeaky Ball Set', cat: 'toys', art: 'ball', tone: 3,
    mrp: 399, price: 299, trade: 224, rating: 4.6, reviews: 287, sizes: ['Set of 3'], size: 0,
    stock: 'In stock',
    desc: 'Natural rubber balls that bounce unpredictably. Floats, so it works at the beach too.',
    bullets: ['Natural rubber', 'Floats in water', 'Fits standard throwers'],
    ingredients: '' },
  { id: 'p17', name: 'Cooling Mat', cat: 'gear', art: 'mat', tone: 0,
    mrp: 1499, price: 1199, trade: 899, rating: 4.5, reviews: 163, sizes: ['M', 'L'], size: 0,
    stock: 'In stock',
    desc: 'Pressure-activated gel that stays about 5°C below room temperature. No water or power needed.',
    bullets: ['No refrigeration needed', 'Wipe clean', 'For Mumbai summers'],
    ingredients: '' },
  { id: 'p18', name: 'Travel Water Bottle', cat: 'gear', art: 'flask', tone: 1,
    mrp: 699, price: 549, trade: 412, rating: 4.8, reviews: 521, sizes: ['350 ml', '550 ml'], size: 1,
    tag: 'Walker pick', stock: 'In stock',
    desc: 'A flip-out bowl on top of the bottle so you can water them mid-walk one-handed. Unused water drains back in.',
    bullets: ['One-handed operation', 'Leak proof', 'Every walker carries one'],
    ingredients: '' }
];

export const COUPONS = [
  { code: 'FIRST20',   title: '20% off your first groom', subtitle: 'Up to ₹400 off · new customers', appliesTo: 'First booking', expires: '31 Aug 2026', redeemed: 184, active: true },
  { code: 'MONSOON15', title: '15% off medicated baths',  subtitle: 'Tick and skin care add-ons',     appliesTo: 'Add-ons',       expires: '30 Sep 2026', redeemed: 42,  active: false },
  { code: 'WALK3',     title: '3rd walk free',            subtitle: 'Book any 2 walks this week',     appliesTo: 'Walks',         expires: '17 Aug 2026', redeemed: 17,  active: false }
];

export const BOOKINGS = [
  { id: 'WT8842', customer: 'C1041', who: 'Aarav Mehta',  pet: 'Simba', kind: 'groom', svc: 'Premium groom', packageId: 'premium', when: 'Today, 10:00 am',        today: true,  partner: 'Ritika Sharma', partnerId: 'P21', status: 'On the way',    total: 1999, channel: 'App' },
  { id: 'WT8871', customer: 'C1203', who: 'Farah Sheikh', pet: 'Coco',  kind: 'groom', svc: 'Luxury groom',  packageId: 'luxury',  when: 'Sun, 9 Aug, 11:00 am',   today: false, partner: 'Ritika Sharma', partnerId: 'P21', status: 'Confirmed',     total: 2199, channel: 'WhatsApp' },
  { id: 'WT8869', customer: 'C1088', who: 'Priya Nair',   pet: 'Mochi', kind: 'groom', svc: 'Luxury groom',  packageId: 'luxury',  when: 'Today, 1:00 pm',         today: true,  partner: 'Unassigned',    partnerId: null,  status: 'Needs partner', total: 2499, channel: 'WhatsApp' },
  { id: 'WT8790', customer: 'C1041', who: 'Aarav Mehta',  pet: 'Mochi', kind: 'groom', svc: 'Luxury groom',  packageId: 'luxury',  when: 'Sat, 15 Aug, 11:00 am',  today: false, partner: 'Aman Verma',    partnerId: 'P34', status: 'Confirmed',     total: 2499, channel: 'App' },
  { id: 'WT8801', customer: 'C1120', who: 'Devika Rao',   pet: 'Bruno', kind: 'walk',  svc: '45 min walk',   walkId: 'w45',        when: 'Today, 6:30 pm',         today: true,  partner: 'Neha Pillai',   partnerId: 'P52', status: 'Confirmed',     total: 349,  channel: 'App' },
  { id: 'WT8511', customer: 'C1156', who: 'Ishaan Gupta', pet: 'Rio',   kind: 'walk',  svc: '45 min walk',   walkId: 'w45',        when: '21 Jun 2026',            today: false, partner: 'Neha Pillai',   partnerId: 'P52', status: 'Completed',     total: 349,  channel: 'App' }
];

export const STORE_ORDERS = [
  { id: 'IPC4462', who: 'Aarav Mehta',   customer: 'C1041', when: 'Today, 9:12 am', items: 2, total: 1148, status: 'Packed',           channel: 'App' },
  { id: 'IPC4461', who: 'Ritika Sharma', customer: null,    when: 'Today, 8:40 am', items: 6, total: 3894, status: 'Packed',           channel: 'Partner' },
  { id: 'IPC4458', who: 'Farah Sheikh',  customer: 'C1203', when: 'Yesterday',      items: 1, total: 999,  status: 'Out for delivery', channel: 'WhatsApp' },
  { id: 'IPC4450', who: 'Devika Rao',    customer: 'C1120', when: '6 Aug',          items: 3, total: 2247, status: 'Delivered',        channel: 'App' },
  { id: 'IPC4447', who: 'Neha Pillai',   customer: null,    when: '5 Aug',          items: 4, total: 1648, status: 'Delivered',        channel: 'Partner' }
];

export const SERVICE_AREAS = [
  { name: 'Andheri West', groomers: 3, walkers: 2, status: 'Active' },
  { name: 'Juhu',         groomers: 2, walkers: 1, status: 'Active' },
  { name: 'Versova',      groomers: 2, walkers: 1, status: 'Active' },
  { name: 'Bandra West',  groomers: 1, walkers: 1, status: 'Active' },
  { name: 'Malad West',   groomers: 1, walkers: 0, status: 'Active' },
  { name: 'Powai',        groomers: 0, walkers: 0, status: 'Pending' }
];

export const BOOKING_SLOTS = [
  { label: '9:00 am',  enabled: false },
  { label: '10:00 am', enabled: true },
  { label: '11:00 am', enabled: true, tag: 'Popular' },
  { label: '12:00 pm', enabled: false },
  { label: '1:00 pm',  enabled: true },
  { label: '2:00 pm',  enabled: true },
  { label: '3:00 pm',  enabled: true, tag: 'Popular' },
  { label: '4:00 pm',  enabled: false },
  { label: '5:00 pm',  enabled: true }
];

export const SETTINGS = [
  { key: 'business_name',        value: 'Wag & Tails',            label: 'Business name',             group: 'business' },
  { key: 'store_brand',          value: 'The Indian Pet Company', label: 'Store brand',               group: 'business' },
  { key: 'whatsapp_number',      value: '+91 90040 22022',        label: 'WhatsApp business number',  group: 'business' },
  { key: 'support_hours',        value: '9:00 am – 9:00 pm',      label: 'Support hours',             group: 'business' },
  { key: 'groomer_fee',          value: '15%',                    label: 'Groomer fee',               group: 'commission' },
  { key: 'walker_fee',           value: '12%',                    label: 'Walker fee',                group: 'commission' },
  { key: 'store_margin',         value: '25%',                    label: 'Store margin',              group: 'commission' },
  { key: 'same_day_cutoff',      value: '2 hours before',         label: 'Same-day booking cut-off',  group: 'policy' },
  { key: 'free_cancel_window',   value: '4 hours',                label: 'Free cancellation window',  group: 'policy' },
  { key: 'late_cancel_fee',      value: '₹200',                   label: 'Late cancellation fee',     group: 'policy' }
];

/* WhatsApp is listed as a business number, not an integration: the Build Book
   records that no messaging integration exists — staff copy a confirmation and
   send it by hand. */
export const INTEGRATIONS = [
  { name: 'Razorpay',    detail: 'Payments and payouts',           icon: 'card', status: 'Live' },
  { name: 'Google Maps', detail: 'Geocoding and live tracking',    icon: 'nav',  status: 'Live' },
  { name: 'Shiprocket',  detail: 'Store fulfilment',               icon: 'bag',  status: 'Not connected' }
];

export const STAFF_PERMISSIONS = [
  { capability: 'Create and edit bookings',   bookingsStaff: true,  support: false, superAdmin: true },
  { capability: 'Assign partners',            bookingsStaff: true,  support: false, superAdmin: true },
  { capability: 'Issue refunds',              bookingsStaff: false, support: true,  superAdmin: true },
  { capability: 'Edit catalogue and pricing', bookingsStaff: false, support: false, superAdmin: true },
  { capability: 'Release payouts',            bookingsStaff: false, support: false, superAdmin: true },
  { capability: 'Approve partners',           bookingsStaff: false, support: false, superAdmin: true }
];

export const MONTHLY_REVENUE = [
  { label: 'Mar', value: 412 }, { label: 'Apr', value: 498 }, { label: 'May', value: 544 },
  { label: 'Jun', value: 610 }, { label: 'Jul', value: 721 }, { label: 'Aug', value: 842, current: true }
];

export const CHANNEL_SPLIT = [
  { label: 'Customer app',      percentage: 58, colour: 'var(--brand-700)' },
  { label: 'WhatsApp via staff', percentage: 27, colour: 'var(--accent-500)' },
  { label: 'Store (repeat)',    percentage: 11, colour: 'var(--brand-300)' },
  { label: 'Referral',          percentage: 4,  colour: 'var(--ok-600)' }
];

export const REVENUE_LINES = [
  { line: 'Grooming',    revenue: '₹28,40,000', share: '78%', growth: '+19%' },
  { line: 'Dog walking', revenue: '₹5,68,000',  share: '16%', growth: '+34%' },
  { line: 'Store',       revenue: '₹2,19,000',  share: '6%',  growth: '+31%' }
];

/* Headline reporting figures the prototype showed with no underlying rows. */
export const METRICS = [
  { key: 'kpi_revenue',        label: 'Revenue this month',  value: '₹8,42,300',  delta: '+18.4%', positive: true,  group: 'dashboard' },
  { key: 'kpi_bookings',       label: 'Bookings',            value: '612',        delta: '+9.1%',  positive: true,  group: 'dashboard' },
  { key: 'kpi_gmv',            label: 'Store GMV',           value: '₹2,18,900',  delta: '+31.7%', positive: true,  group: 'dashboard' },
  { key: 'kpi_cancellation',   label: 'Cancellation rate',   value: '4.2%',       delta: '−1.3%',  positive: true,  group: 'dashboard' },
  { key: 'rep_gross',          label: 'Gross revenue',       value: '₹36,27,000', delta: '+22.4%', positive: true,  group: 'reports' },
  { key: 'rep_avg_booking',    label: 'Avg booking value',   value: '₹1,684',     delta: '+4.1%',  positive: true,  group: 'reports' },
  { key: 'rep_repeat',         label: 'Repeat rate',         value: '61%',        delta: '+6.8%',  positive: true,  group: 'reports' },
  { key: 'rep_utilisation',    label: 'Partner utilisation', value: '73%',        delta: '−2.2%',  positive: false, group: 'reports' },
  { key: 'pay_released_month', label: 'Released this month', value: '₹2,84,120',  delta: null,     positive: null,  group: 'payouts' },
  { key: 'pay_platform_fee',   label: 'Platform fee earned', value: '₹48,900',    delta: null,     positive: null,  group: 'payouts' },
  { key: 'donut_total',        label: 'Bookings in period',  value: '612',        delta: null,     positive: null,  group: 'reports' }
];
