export const CATEGORIES = [
  { id: 'produce',   label: 'Produce',        emoji: '🥬', color: '#97C459' },
  { id: 'dairy',     label: 'Dairy & Eggs',   emoji: '🥛', color: '#5DCAA5' },
  { id: 'meat',      label: 'Meat & Seafood', emoji: '🥩', color: '#E24B4A' },
  { id: 'bakery',    label: 'Bakery',         emoji: '🍞', color: '#EF9F27' },
  { id: 'frozen',    label: 'Frozen',         emoji: '🧊', color: '#818cf8' },
  { id: 'beverages', label: 'Beverages',      emoji: '🧃', color: '#22d3ee' },
  { id: 'pantry',    label: 'Pantry',         emoji: '🥫', color: '#f59e0b' },
  { id: 'deli',      label: 'Deli',           emoji: '🥪', color: '#ec4899' },
  { id: 'household', label: 'Household',      emoji: '🧹', color: '#8b5cf6' },
  { id: 'personal',  label: 'Personal Care',  emoji: '🧴', color: '#06b6d4' },
  { id: 'recipes',   label: 'Recipes',        emoji: '📖', color: '#7c66ff' },
  { id: 'other',     label: 'Other',          emoji: '🛒', color: '#9ca3af' },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const RULES = {
  produce: [
    'apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry', 'raspberry', 'blackberry',
    'lemon', 'lime', 'mango', 'pineapple', 'watermelon', 'melon', 'peach', 'pear', 'plum',
    'cherry', 'avocado', 'tomato', 'potato', 'onion', 'garlic', 'ginger', 'carrot', 'celery',
    'lettuce', 'spinach', 'kale', 'arugula', 'broccoli', 'cauliflower', 'cabbage', 'zucchini',
    'cucumber', 'pepper', 'jalapeno', 'mushroom', 'corn', 'asparagus', 'artichoke', 'beet',
    'radish', 'turnip', 'sweet potato', 'yam', 'basil', 'cilantro', 'parsley', 'mint',
    'thyme', 'rosemary', 'dill', 'chive', 'scallion', 'leek', 'shallot', 'berries',
    'salad', 'greens', 'herb', 'fresh', 'vegetable', 'fruit', 'produce', 'chard', 'bok choy',
    'fennel', 'butternut', 'squash', 'acorn', 'pumpkin', 'broccolini', 'edamame fresh',
  ],
  dairy: [
    'milk', 'cheese', 'butter', 'yogurt', 'cream', 'half and half', 'sour cream',
    'cottage cheese', 'ricotta', 'mozzarella', 'cheddar', 'parmesan', 'brie', 'gouda',
    'cream cheese', 'whipped cream', 'egg', 'eggs', 'dairy', 'kefir', 'ghee', 'queso',
    'provolone', 'swiss', 'colby', 'monterey', 'american cheese', 'feta', 'blue cheese',
  ],
  meat: [
    'beef', 'chicken', 'pork', 'lamb', 'turkey', 'salmon', 'tuna', 'shrimp', 'fish',
    'steak', 'ground beef', 'ground turkey', 'bacon', 'sausage', 'ham', 'pepperoni',
    'salami', 'prosciutto', 'lobster', 'crab', 'scallop', 'clam', 'oyster', 'tilapia',
    'cod', 'halibut', 'mahi', 'meat', 'seafood', 'poultry', 'rib', 'roast', 'chop',
    'fillet', 'wing', 'thigh', 'breast', 'drumstick', 'brisket', 'tenderloin', 'sirloin',
    'ground pork', 'veal', 'venison', 'duck', 'sardine', 'anchovy', 'catfish', 'trout',
  ],
  bakery: [
    'bread', 'bagel', 'muffin', 'croissant', 'baguette', 'roll', 'bun', 'pita',
    'tortilla', 'wrap', 'cake', 'cookie', 'pastry', 'donut', 'brownie', 'pie', 'tart',
    'cracker', 'pretzel', 'bakery', 'sourdough', 'focaccia', 'naan', 'brioche',
    'english muffin', 'flatbread', 'pumpernickel', 'rye bread',
  ],
  frozen: [
    'frozen', 'ice cream', 'sorbet', 'gelato', 'popsicle', 'waffle', 'pancake',
    'pot pie', 'fish stick', 'nugget', 'edamame', 'frozen pizza', 'frozen meal',
    'frozen burrito', 'tater tot', 'french fry', 'hash brown', 'frozen veggie',
    'frozen fruit', 'smoothie pack', 'frozen dinner',
  ],
  beverages: [
    'water', 'juice', 'soda', 'coffee', 'tea', 'beer', 'wine', 'spirits', 'whiskey',
    'kombucha', 'smoothie', 'drink', 'sparkling', 'lemonade', 'iced tea', 'energy drink',
    'sports drink', 'cocoa', 'hot chocolate', 'almond milk', 'oat milk', 'soy milk',
    'coconut milk', 'broth', 'stock', 'gatorade', 'cola', 'sparkling water', 'espresso',
    'cold brew', 'cider', 'champagne', 'bourbon', 'vodka', 'rum', 'tequila',
  ],
  pantry: [
    'pasta', 'rice', 'cereal', 'oat', 'flour', 'sugar', 'salt', 'pepper', 'oil',
    'vinegar', 'sauce', 'ketchup', 'mustard', 'mayo', 'mayonnaise', 'relish', 'pickle',
    'olive', 'jam', 'jelly', 'honey', 'syrup', 'peanut butter', 'almond butter',
    'chip', 'popcorn', 'nut', 'almond', 'walnut', 'cashew', 'pecan', 'pistachio',
    'raisin', 'dried fruit', 'granola', 'canned', 'soup', 'bean', 'lentil',
    'chickpea', 'quinoa', 'couscous', 'noodle', 'spaghetti', 'penne', 'fettuccine',
    'lasagna', 'macaroni', 'spice', 'seasoning', 'baking powder', 'baking soda', 'yeast',
    'chocolate', 'cocoa powder', 'vanilla', 'breadcrumb', 'panko', 'salsa', 'hot sauce',
    'soy sauce', 'fish sauce', 'teriyaki', 'ranch', 'dressing', 'marinade', 'spread',
    'peanuts', 'trail mix', 'crackers', 'coconut', 'protein powder', 'protein bar',
    'olive oil', 'vegetable oil', 'coconut oil', 'tahini', 'miso', 'hoisin',
  ],
  deli: [
    'deli', 'lunch meat', 'cold cut', 'rotisserie', 'prepared', 'hummus', 'guacamole',
    'coleslaw', 'potato salad', 'antipasto', 'charcuterie', 'smoked salmon', 'pate',
  ],
  household: [
    'paper towel', 'toilet paper', 'tissue', 'napkin', 'aluminum foil', 'plastic wrap',
    'zip bag', 'trash bag', 'garbage bag', 'dish soap', 'laundry', 'detergent', 'bleach',
    'cleaner', 'sponge', 'scrub', 'battery', 'candle', 'light bulb', 'cleaning',
    'disinfectant', 'lysol', 'windex', 'dryer sheet', 'fabric softener', 'paper plates',
    'ziplock', 'parchment', 'wax paper', 'coffee filter', 'air freshener', 'mop',
  ],
  personal: [
    'shampoo', 'conditioner', 'soap', 'body wash', 'lotion', 'moisturizer', 'sunscreen',
    'deodorant', 'toothpaste', 'toothbrush', 'floss', 'mouthwash', 'razor', 'shaving',
    'makeup', 'lipstick', 'foundation', 'mascara', 'cotton', 'q-tip', 'bandage',
    'medicine', 'vitamin', 'supplement', 'ibuprofen', 'tylenol', 'antacid', 'advil',
    'nyquil', 'melatonin', 'face wash', 'toner', 'serum', 'hair gel', 'hair spray',
  ],
};

export function categorize(name) {
  const lower = name.toLowerCase();
  for (const [catId, keywords] of Object.entries(RULES)) {
    if (keywords.some(kw => lower.includes(kw))) return catId;
  }
  return 'other';
}
