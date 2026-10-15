import { emptyExperiences, type Experiences } from './experiences';
// Stable IDs are import keys. Dates below are research leads from issue #30, not live inventory.
export function experienceSeeds(): Experiences {
  const data = emptyExperiences();
  const add = (key: string, name: string, website: string, area: string, category: string, offerings: Array<[string, string, string?, string?]>, notes = '') => {
    const organiserId = `seed-${key}`;
    data.organisers.push({ id: organiserId, name, website, location: '', area, lat: null, lng: null, categories: [category], interest: 'Interested', notes, sourceUrl: website });
    offerings.forEach(([slug, title, start = '', end = '']) => {
      const id = `${organiserId}-${slug}`;
      data.offerings.push({ id, organiserId, title, category, description: 'Single-session experience lead. Check the organiser for current options, price, eligibility and availability.', priceMin: null, priceMax: null, status: 'Want to try', completionCount: 0, lastCompletedDate: '' });
      if (start) data.sessions.push({ id: `${id}-${start}`, offeringId: id, title, start, end, price: null, bookingUrl: website, status: 'Interested', lastVerifiedAt: '', notes: 'Unverified lead from issue #30. Reconfirm dates, price, eligibility and availability.', diaryEntryId: '' });
    });
  };
  add('wine-food', 'Wine & Food Foundation', 'https://winefoodfoundation.org/events/', 'Austin / various', 'Wine & drinks', [['wine','Wine tasting — Rhys Vineyards','2026-11-12']]);
  add('woodcraft', 'Woodcraft Austin', 'https://www.woodcraft.com/pages/store-classes/austin', 'Austin', 'Arts & crafts', [['knife','Custom knife handle','2026-11-12'],['turning','Woodturning','2026-11-13'],['board','Cutting board','2026-11-14']]);
  add('cordovan', 'Cordovan Art School', 'https://cordovanartschool.com/nw-austin-workshops-events/', 'Northwest Austin', 'Arts & crafts', [['wheel','Beginner pottery wheel','2026-11-14'],['plate','Christmas cookie plate','2026-12-05']]);
  add('book-festival', 'Texas Book Festival', 'https://www.texasbookfestival.org/', 'Austin / various', 'Culture & comedy', [['authors','Author events','2026-11-14','2026-11-15']]);
  add('studio-tour', 'Austin Studio Tour', 'https://atxstudiotour.com/', 'Austin / various', 'Arts & crafts', [['studios','Studio visits','2026-11-14','2026-11-15']]);
  data.sessions.push({ ...data.sessions[data.sessions.length-1], id:'seed-studio-tour-studios-2026-11-21', start:'2026-11-21', end:'2026-11-22' });
  add('central-market', 'Central Market Cooking School', 'https://www.centralmarket.com/', 'Austin', 'Food & cooking', [['demo','Demo and dine','2026-11-18']]);
  add('xtreme', 'Xtreme Xperience / COTA', 'https://www.thextremexperience.com/tracks/cota', 'Southeast Austin / COTA', 'Outdoors & adventure', [['supercar','Supercar driving','2026-11-18','2026-11-20']]);
  add('agms', 'Austin Gem & Mineral Society', 'https://www.agms-tx.org/', 'Austin', 'Arts & crafts', [['silver','Silversmithing','2026-11-21','2026-11-22']]);
  add('mozarts', "Mozart’s Coffee", 'https://mozartscoffee.com/', 'Lake Austin', 'Culture & comedy', [['lights','Festival of Lights','2026-11-21']], 'Season lead starts November 21; closing date and individual sessions to check.');
  add('turkey-trot', 'ThunderCloud Subs', 'https://www.thundercloud.com/turkey-trot/', 'Austin', 'Fitness & sport', [['trot','Turkey Trot','2026-11-26']]);
  add('pioneer', 'Pioneer Farms', 'https://www.pioneerfarms.org/', 'Northeast Austin', 'Arts & crafts', [['forge','Blacksmithing','2026-12-05']], 'Check age eligibility before booking blacksmithing.');
  add('ghost-pepper', 'Ghost Pepper Glass', 'https://ghostpepperglass.com/portfolio/taste-of-glassblowing/', 'Austin', 'Arts & crafts', [['glass','Taste of glassblowing']]);
  add('winos', 'Texas Winos', 'https://www.texaswinos.com/events/tx/austin/2026-11-01', 'Travelling / excursions', 'Wine & drinks', [['wine','Winery excursion'],['beer','Brewery excursion'],['spirits','Distillery excursion']]);
  add('sur-la-table', 'Sur La Table', 'https://www.surlatable.com/locations/tx/austin/cooking-classes-152.html', 'Austin', 'Food & cooking', [['cooking','Single-session cooking class']]);
  add('prickly-pear', 'Prickly Pear Cooking Classes', 'https://www.thepricklypearcookingclasses.com/', 'Austin', 'Food & cooking', [['pasta','Pasta making'],['cooking','Cooking workshop']]);
  add('sommspace', 'SommSpace', 'https://www.sommspaceatx.com/', 'Austin', 'Wine & drinks', [['wine','Wine tasting']]);
  add('white-horse', 'The White Horse / Dancin’ Austin', 'https://www.thewhitehorseaustin.com/events', 'East Austin', 'Music & dance', [['dance','Two-step lesson']]);
  add('drinkwell', 'DrinkWell', 'https://www.drinkwellaustin.com/events', 'North Austin', 'Wine & drinks', [['cocktails','Cocktail workshop']]);
  add('archery-country', 'Archery Country', 'https://www.austinarcherycountry.com/pages/archery-lessons', 'Austin', 'Outdoors & adventure', [['archery','Beginner archery lesson']]);
  add('blue-moon', 'Blue Moon Glassworks', 'https://bluemoonglassworks.com/collections/classes', 'North Austin', 'Arts & crafts', [['stained','Stained glass workshop']]);
  add('zipline', 'Lake Travis Zipline Adventures', 'https://ziplaketravis.com/', 'Lake Travis', 'Outdoors & adventure', [['zip','Zipline adventure']]);
  add('circus', 'Upstairs Circus', 'https://upstairscircus.com/atx/', 'Downtown Austin', 'Arts & crafts', [['craft','DIY project social']]);
  add('fierce', 'Fierce Whiskers Distillery', 'https://www.fiercewhiskers.com/pages/tours', 'South Austin', 'Wine & drinks', [['whiskey','Distillery tour and whiskey tasting']]);
  add('hideout', 'The Hideout Theatre', 'https://hideouttheatre.com/', 'Austin', 'Culture & comedy', [['improv','Intro improv workshop']], 'Look for a standalone introductory session rather than a multi-week course.');
  return data;
}
