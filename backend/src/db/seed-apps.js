/* App-side seed data, ported from the prototype's js/data.js.
   The three pets, their health records and grooming history; the customer's
   addresses and payment methods; the partner job feeds and earnings. */

export const PET_RECORDS = [
  {
    code: 'simba', name: 'Simba', breed: 'Beagle', age: '3 yr', dob: '14 Mar 2023', sex: 'Male',
    weight: '12 kg', size: 'Medium', neutered: 'Yes',
    art: { id: 'simba', bg1: '#E9CBA0', bg2: '#C2914F', coat: '#F5E7D6', coatDark: '#C68B4A',
           ear: 'drop', ear2: '#8B4E22', muzzle: '#FFF7EC' },
    coat: 'Short double coat',
    temperament: 'Friendly and food-motivated. Wriggles during nail clipping.',
    allergies: 'Chicken — mild skin flare-ups', vaccinated: 'Up to date', nextVaccine: '12 Nov 2026',
    vaccines: [
      { name: 'Rabies', date: '12 Nov 2025', next: '12 Nov 2026', ok: true },
      { name: 'DHPPi', date: '12 Nov 2025', next: '12 Nov 2026', ok: true },
      { name: 'Leptospirosis', date: '02 Apr 2026', next: '02 Apr 2027', ok: true },
      { name: 'Deworming', date: '18 Jun 2026', next: '18 Sep 2026', ok: true }
    ],
    microchip: '900 1234 5678 901', vet: 'Dr. Anand Rao', vetClinic: 'Paws Clinic, Andheri West',
    vetPhone: '+91 98200 41122',
    careNote: 'Hates having his ears touched, go slow.',
    history: [
      { code: 'h1', date: '14 Jun 2026', pkg: 'premium', partner: 'P21', rating: 5, mins: 92,
        note: 'Coat in good shape. Nails trimmed short, he was calm throughout.' },
      { code: 'h2', date: '02 Apr 2026', pkg: 'basic', partner: 'P34', rating: 5, mins: 58,
        note: 'Slight dryness on the back — suggested an oatmeal shampoo next time.' },
      { code: 'h3', date: '11 Jan 2026', pkg: 'standard', partner: 'P21', rating: 4, mins: 66, note: '' }
    ]
  },
  {
    code: 'mochi', name: 'Mochi', breed: 'Shih Tzu', age: '1 yr', dob: '22 Jul 2025', sex: 'Female',
    weight: '5 kg', size: 'Small', neutered: 'No',
    art: { id: 'mochi', bg1: '#F2DAC3', bg2: '#D8A87E', coat: '#FFF6EA', coatDark: '#D8B58E',
           ear: 'fluff', ear2: '#DDB98F', muzzle: '#FFFCF6' },
    coat: 'Long silky coat, mats easily',
    temperament: 'Shy with strangers, settles after a few minutes.',
    allergies: 'None recorded', vaccinated: 'Up to date', nextVaccine: '28 Sep 2026',
    vaccines: [
      { name: 'Rabies', date: '28 Sep 2025', next: '28 Sep 2026', ok: true },
      { name: 'DHPPi', date: '28 Sep 2025', next: '28 Sep 2026', ok: true },
      { name: 'Deworming', date: '10 Jul 2026', next: '10 Oct 2026', ok: true }
    ],
    microchip: '900 8877 2201 445', vet: 'Dr. Meera Iyer', vetClinic: 'Petcare Vet, Versova',
    vetPhone: '+91 98333 70910',
    careNote: 'Mats behind the ears, needs de-matting.',
    history: [
      { code: 'h4', date: '21 Jun 2026', pkg: 'luxury', partner: 'P21', rating: 5, mins: 118,
        note: 'Heavy matting behind both ears, cleared by hand. Book de-matting again in 6 weeks.' },
      { code: 'h5', date: '19 Apr 2026', pkg: 'bathbasic', partner: 'P34', rating: 5, mins: 74, note: '' }
    ]
  },
  {
    code: 'rio', name: 'Rio', breed: 'Indie', age: '5 yr', dob: '09 Feb 2021', sex: 'Male',
    weight: '18 kg', size: 'Large', neutered: 'Yes',
    art: { id: 'rio', bg1: '#DCB78E', bg2: '#A9703C', coat: '#E5BC88', coatDark: '#A97230',
           ear: 'prick', ear2: '#C9954F', muzzle: '#F8E2C6' },
    coat: 'Short single coat',
    temperament: 'Confident and strong. Great with people, wary of cats.',
    allergies: 'Grain-heavy kibble', vaccinated: 'Booster due', nextVaccine: '19 Aug 2026',
    vaccines: [
      { name: 'Rabies', date: '19 Aug 2025', next: '19 Aug 2026', ok: false },
      { name: 'DHPPi', date: '19 Aug 2025', next: '19 Aug 2026', ok: false },
      { name: 'Deworming', date: '01 Jun 2026', next: '01 Sep 2026', ok: true }
    ],
    microchip: '900 4412 9088 337', vet: 'Dr. Anand Rao', vetClinic: 'Paws Clinic, Andheri West',
    vetPhone: '+91 98200 41122',
    careNote: 'Pulls hard on the leash, use the harness.',
    history: [
      { code: 'h6', date: '30 May 2026', pkg: 'standard', partner: 'P34', rating: 4, mins: 64, note: '' }
    ]
  }
];

/* Bruno and Coco belong to other customers and carry only a care note; the
   consoles already seed them from 001. */
export const EXTRA_PET_ART = {
  Bruno: { id: 'bruno', bg1: '#E4D3BC', bg2: '#B4906A', coat: '#F0E2CD', coatDark: '#C29A6B',
           ear: 'drop', ear2: '#9A7346', muzzle: '#FBF3E6' },
  Coco: { id: 'coco', bg1: '#F1DFC0', bg2: '#CBA463', coat: '#F8ECD4', coatDark: '#D3AB6C',
          ear: 'fluff', ear2: '#BE9354', muzzle: '#FDF7EA' }
};

export const CUSTOMER_ACCOUNT = {
  id: 'C1041', first: 'Aarav', email: 'aarav.mehta@gmail.com', wallet: 240,
  addresses: [
    { code: 'home', label: 'Home', kind: 'home', line1: 'Flat 402, Palm Grove',
      line2: 'Andheri West, Mumbai 400053', landmark: 'Opposite Lokhandwala Market', isDefault: true },
    { code: 'work', label: 'Work', kind: 'work', line1: 'Unit 11, Raheja Centre',
      line2: 'BKC, Mumbai 400051', landmark: 'Gate 3, visitor parking', isDefault: false }
  ],
  payments: [
    { code: 'upi', label: 'UPI', subtitle: 'aarav@okhdfc', kind: 'upi', isDefault: true },
    { code: 'visa', label: 'Visa •••• 4821', subtitle: 'Expires 09/28', kind: 'card', isDefault: false },
    { code: 'cash', label: 'Cash after service', subtitle: 'Pay the groomer directly', kind: 'cash', isDefault: false }
  ]
};

/* Customer-side bookings beyond the six the consoles seed. Together these give
   the app an active job, a scheduled one, and real history to show. */
export const APP_BOOKINGS = [
  { id: 'WT8402', customer: 'C1041', who: 'Aarav Mehta', pet: 'Simba', kind: 'groom',
    packageId: 'basic', svc: 'Basic groom', when: '02 Apr 2026 · 2:00 pm', date: '02 Apr 2026',
    slot: '2:00 pm', partner: 'Aman Verma', partnerId: 'P34', status: 'Completed', total: 999,
    channel: 'App', paid: true, rating: 5, addons: [] },
  { id: 'WT8388', customer: 'C1088', who: 'Priya Nair', pet: 'Mochi', kind: 'groom',
    packageId: 'bathbasic', svc: 'Bath + Basic groom', when: '19 Apr 2026 · 10:00 am',
    date: '19 Apr 2026', slot: '10:00 am', partner: 'Aman Verma', partnerId: 'P34',
    status: 'Completed', total: 1299, channel: 'App', paid: true, rating: 5, addons: [] },
  { id: 'WT8201', customer: 'C1120', who: 'Devika Rao', pet: 'Rio', kind: 'groom',
    packageId: 'standard', svc: 'Standard groom', when: '30 May 2026 · 4:00 pm', date: '30 May 2026',
    slot: '4:00 pm', partner: 'Aman Verma', partnerId: 'P34', status: 'Cancelled', total: 1399,
    channel: 'App', paid: false, cancelReason: 'Rescheduled by customer', addons: [] }
];

/* Add-ons on the seeded bookings. WT8842 carries tick removal; WT8790 a
   medicated bath — the Build Book notes the original de-matting add-on was
   changed because Luxury already includes it. */
export const BOOKING_ADDONS = {
  WT8842: ['tick'],
  WT8790: ['medbath']
};

export const BOOKING_STEPS = {
  WT8842: [
    ['Booking confirmed', '9:02 am', 'done'],
    ['Groomer assigned', '9:04 am', 'done'],
    ['On the way', '10:12 am', 'now'],
    ['Grooming in progress', '', 'todo'],
    ['Completed', '', 'todo']
  ]
};

/* Open jobs the partner app shows as claimable, and jobs already assigned.
   Both are derived from bookings at read time; these rows only supply the
   payout and distance the feed displays. */
export const JOB_META = {
  WT8869: { payout: 1540, km: 2.1, expires: 38 },
  WT8842: { payout: 1420, km: 1.2 },
  WT8790: { payout: 1420, km: 4.0 },
  WT8871: { payout: 1830, km: 3.2 },
  WT8801: { payout: 280, km: 0.8 },
  WT8511: { payout: 280, km: 1.4 }
};

export const PARTNER_EARNINGS = {
  P21: [
    { label: 'Premium · Simba', on: 'Fri, 7 Aug', amount: 1420 },
    { label: 'Luxury · Mochi', on: 'Fri, 7 Aug', amount: 1060 },
    { label: 'Standard · Rio', on: 'Thu, 6 Aug', amount: 980 },
    { label: 'Bath + Basic · Coco', on: 'Wed, 5 Aug', amount: 1080 },
    { label: 'Premium · Bruno', on: 'Wed, 5 Aug', amount: 1420 }
  ],
  P34: [
    { label: 'Basic · Simba', on: 'Thu, 6 Aug', amount: 720 },
    { label: 'Standard · Rio', on: 'Wed, 5 Aug', amount: 980 },
    { label: 'Luxury · Mochi', on: 'Tue, 4 Aug', amount: 1780 }
  ],
  P52: [
    { label: '45 min walk · Rio', on: 'Sat, 8 Aug', amount: 280 },
    { label: '30 min walk · Mochi', on: 'Sat, 8 Aug', amount: 190 },
    { label: '60 min walk · Simba', on: 'Fri, 7 Aug', amount: 340 },
    { label: '45 min walk · Bruno', on: 'Thu, 6 Aug', amount: 280 }
  ],
  P61: [
    { label: '30 min walk · Coco', on: 'Fri, 7 Aug', amount: 190 },
    { label: '45 min walk · Bruno', on: 'Thu, 6 Aug', amount: 280 }
  ]
};

/* Weekday totals behind the earnings bar chart. */
export const EARNINGS_WEEK = {
  Groomer: [['Mon', 2140], ['Tue', 1420], ['Wed', 3060], ['Thu', 980], ['Fri', 2480], ['Sat', 0], ['Sun', 0]],
  Walker: [['Mon', 680], ['Tue', 910], ['Wed', 530], ['Thu', 1120], ['Fri', 840], ['Sat', 530], ['Sun', 0]]
};

export const REVIEWS = [
  { partner: 'P21', author: 'Aarav M.', pet: 'Simba', rating: 5, when: '2 weeks ago',
    body: 'Ritika was gentle with his ears exactly as I asked. Coat looks great.' },
  { partner: 'P21', author: 'Priya N.', pet: 'Coco', rating: 5, when: '3 weeks ago',
    body: 'On time, tidy, and left the bathroom spotless. Booking again.' },
  { partner: 'P34', author: 'Devika R.', pet: 'Bruno', rating: 4, when: '1 month ago',
    body: 'Good trim. Ran about 15 minutes late but messaged ahead.' },
  { partner: 'P34', author: 'Ishaan G.', pet: 'Mochi', rating: 5, when: '1 month ago',
    body: 'Handled a very matted coat patiently. Worth the Luxury package.' },
  { partner: 'P52', author: 'Aarav M.', pet: 'Rio', rating: 5, when: '1 week ago',
    body: 'Sends a photo from every walk. Rio comes back properly tired.' }
];

export const NOTIFICATIONS = [
  { customer: 'C1041', kind: 'booking', title: 'Ritika is on the way',
    body: 'Arriving around 10:40 am for Simba’s Premium groom.', when: '12 min ago', unread: true },
  { customer: 'C1041', kind: 'health', title: 'Rio’s rabies booster is due',
    body: 'Due 19 Aug 2026. Book a vet visit or update the record.', when: 'Yesterday', unread: true },
  { customer: 'C1041', kind: 'offer', title: '20% off your first groom',
    body: 'Use FIRST20 at checkout. Valid until 31 Aug.', when: '2 days ago', unread: false },
  { customer: 'C1041', kind: 'booking', title: 'Walk completed',
    body: 'Neha walked Rio for 45 minutes · 3.4 km.', when: '21 Jun', unread: false },
  { partner: 'P21', kind: 'job', title: 'New job near you',
    body: 'Luxury groom in Versova · ₹1,540 payout.', when: '5 min ago', unread: true },
  { partner: 'P21', kind: 'payout', title: 'Payout scheduled',
    body: 'Your weekly batch releases Monday 10 Aug.', when: 'Yesterday', unread: false }
];

export const FAQS = [
  { q: 'What should I keep ready before the groomer arrives?',
    a: 'A bathroom or balcony with a tap and a power point. The groomer brings shampoo, dryer, clippers and towels.' },
  { q: 'How long does a groom take?',
    a: 'Between 60 and 120 minutes depending on the package, coat length and how settled your dog is.' },
  { q: 'Can I stay in the room?',
    a: 'Yes. Most dogs settle faster with their owner nearby, especially the first time.' },
  { q: 'What if my dog is anxious or reactive?',
    a: 'Add it to the care notes on your pet’s profile. We match you with a groomer experienced with anxious dogs and allow extra time.' },
  { q: 'How do I reschedule or cancel?',
    a: 'Open the booking and tap Reschedule or Cancel. Free up to 4 hours before the slot; after that a ₹200 fee applies.' },
  { q: 'When am I charged?',
    a: 'After the service is completed and you have seen the before and after photos.' }
];

export const BREEDS = [
  'Beagle', 'Shih Tzu', 'Indie', 'Labrador', 'Golden Retriever', 'Pug',
  'German Shepherd', 'Cocker Spaniel', 'Dachshund', 'Rottweiler',
  'Great Dane', 'Pomeranian', 'Husky', 'Mixed breed'
];

export const CANCEL_REASONS = [
  'Booked by mistake', 'Found a better time', 'Pet is unwell',
  'Groomer is running late', 'Price is too high', 'Other'
];

export const ORDER_STEPS = {
  IPC4462: [['Order placed', 'Today, 9:12 am', true], ['Packed', 'Today, 11:40 am', true],
            ['Out for delivery', '', false], ['Delivered', '', false]],
  IPC4450: [['Order placed', '6 Aug', true], ['Packed', '6 Aug', true],
            ['Out for delivery', '7 Aug', true], ['Delivered', '7 Aug', true]]
};
