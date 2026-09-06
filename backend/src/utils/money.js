/* Indian number formatting, matching the prototype's inr() exactly. */
export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

/* Commission rates come from the settings table; these are the fallbacks that
   match what the admin console displays. */
export const GROOMER_FEE = 0.15;
export const WALKER_FEE = 0.12;
