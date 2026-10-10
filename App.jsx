import React, { useState, useEffect, useRef } from 'react';
import { Search, GripVertical, Star, MapPin, Trash2, Plus, Sparkles, X, UserPlus, Users, LogOut, Bookmark, BookmarkPlus, Check } from 'lucide-react';

import { getFirebase, loadFirestoreSdk, databaseErrorMessage, isDemoMode } from './firebase.js';
import { watchAuth, logOut, addEmail } from './auth.js';
import { loadUser, createProfile, saveLists, saveHomeCity, submitRanking, loadAllUsers as fetchAllUsers, loadFollowers as fetchFollowers, setFollowing as saveFollowing } from './userStore.js';
import AuthScreen from './AuthScreen.jsx';
import PlacesMap from './PlacesMap.jsx';
import { fuzzySearch, normalize } from './fuzzySearch.js';

// What each category is, in every city.
const CATEGORIES = {
  burgers: {
    label: 'Burgers',
    emoji: '🍔',
    singular: 'burger',
    plural: 'burgers',
    searchPlaceholder: 'Search for burger spots in',
    commentPlaceholder: 'What makes this burger special?',
    tags: ["Classic", "Upscale", "Vegetarian", "Smash Burger", "Fast Casual", "Gastropub", "Dive Bar", "Hidden Gem", "Steakhouse", "Chain", "No-frills", "Instagrammable", "Frita"],
  },
  martinis: {
    label: 'Martinis',
    emoji: '🍸',
    singular: 'martini',
    plural: 'martinis',
    searchPlaceholder: 'Search for martini bars in',
    commentPlaceholder: 'What makes this martini special?',
    tags: ["Classic", "Dirty", "Gin", "Vodka", "Hotel Bar", "Speakeasy", "Steakhouse", "Upscale", "Dive Bar", "Hidden Gem", "Happy Hour", "Instagrammable"],
  },
  pizza: {
    label: 'Pizza',
    emoji: '🍕',
    singular: 'pizza',
    plural: 'pizzas',
    searchPlaceholder: 'Search for pizza places in',
    commentPlaceholder: 'What makes this pizza special?',
    tags: ["Slice", "Whole Pie", "New York Style", "Neapolitan", "Sicilian", "Grandma", "Coal Oven", "Wood-Fired", "Classic", "Hidden Gem", "Cash Only", "Late Night"],
  },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);

// Each city has its own lists, leaderboard, map and recommended spots. Recommended spots
// carry approximate map coordinates; chains listed as "Multiple Locations" are pinned at
// one well-known branch. Their ids must be unique across cities, so a Shake Shack found in
// Miami isn't counted as the NYC one.
const CITIES = {
  nyc: {
    label: 'NYC',
    name: 'New York City',
    center: [40.735, -73.99],
    fallbackAddress: 'New York, NY',
    picks: {
      burgers: {
        title: 'Recommended by Eater & Timeout',
        aiPlaceholder: "E.g., I'm in the West Village, find me a burger spot",
        spots: [
        { name: "Raoul's", address: "180 Prince St, NY 10012", place_id: "raouls", location: { lat: 40.7266, lng: -74.0027 }, source: "Eater", tags: ["Classic", "Upscale"] },
        { name: "J.G. Melon", address: "1291 3rd Ave, NY 10021", place_id: "jgmelon", location: { lat: 40.7712, lng: -73.959 }, source: "Timeout", tags: ["Classic", "No-frills"] },
        { name: "Corner Bistro", address: "331 W 4th St, NY 10014", place_id: "corner", location: { lat: 40.7378, lng: -74.0039 }, source: "Eater", tags: ["Classic", "Dive Bar"] },
        { name: "Shake Shack", address: "Multiple Locations", place_id: "shakeshack", location: { lat: 40.7415, lng: -73.9882 }, source: "Timeout", tags: ["Chain", "Fast Casual"] },
        { name: "Superiority Burger", address: "119 Avenue A, NY 10009", place_id: "superiority", location: { lat: 40.7262, lng: -73.9834 }, source: "Eater", tags: ["Vegetarian"] },
        { name: "Emily", address: "Multiple Locations", place_id: "emily", location: { lat: 40.729, lng: -74.0034 }, source: "Eater", tags: ["Upscale"] },
        { name: "Minetta Tavern", address: "113 MacDougal St, NY 10012", place_id: "minetta", location: { lat: 40.7302, lng: -74.0006 }, source: "Eater", tags: ["Upscale", "Classic"] },
        { name: "Burger Joint", address: "119 W 56th St, NY 10019", place_id: "burgerjoint", location: { lat: 40.7643, lng: -73.9784 }, source: "Timeout", tags: ["Hidden Gem"] },
        { name: "Peter Luger", address: "178 Broadway, Brooklyn", place_id: "luger", location: { lat: 40.7099, lng: -73.9623 }, source: "Eater", tags: ["Steakhouse"] },
        { name: "Black Tap", address: "Multiple Locations", place_id: "blacktap", location: { lat: 40.7237, lng: -74.0045 }, source: "Timeout", tags: ["Instagrammable"] },
        { name: "Flip Sigi", address: "324 E 11th St, NY 10003", place_id: "flipsigi", location: { lat: 40.7295, lng: -73.984 }, source: "Eater", tags: ["Smash Burger"] },
        ],
      },
      martinis: {
        title: 'Popular Martini Spots',
        aiPlaceholder: "E.g., Somewhere classy near Grand Central for a dirty martini",
        spots: [
        { name: "Bemelmans Bar", address: "35 E 76th St, NY 10021", place_id: "bemelmans", location: { lat: 40.7742, lng: -73.9634 }, tags: ["Hotel Bar", "Classic"] },
        { name: "King Cole Bar", address: "2 E 55th St, NY 10022", place_id: "kingcole", location: { lat: 40.7614, lng: -73.975 }, tags: ["Hotel Bar", "Upscale"] },
        { name: "Dante", address: "79-81 MacDougal St, NY 10012", place_id: "dante", location: { lat: 40.729, lng: -74.0021 }, tags: ["Classic", "Happy Hour"] },
        { name: "The Campbell", address: "15 Vanderbilt Ave, NY 10017", place_id: "campbell", location: { lat: 40.7527, lng: -73.9772 }, tags: ["Upscale", "Hidden Gem"] },
        { name: "Temple Bar", address: "332 Lafayette St, NY 10012", place_id: "templebar", location: { lat: 40.7255, lng: -73.9947 }, tags: ["Classic", "Speakeasy"] },
        { name: "Keens Steakhouse", address: "72 W 36th St, NY 10018", place_id: "keens", location: { lat: 40.7508, lng: -73.9866 }, tags: ["Steakhouse", "Classic"] },
        { name: "Employees Only", address: "510 Hudson St, NY 10014", place_id: "employeesonly", location: { lat: 40.7335, lng: -74.006 }, tags: ["Speakeasy"] },
        { name: "Gage & Tollner", address: "372 Fulton St, Brooklyn", place_id: "gagetollner", location: { lat: 40.6905, lng: -73.9878 }, tags: ["Classic", "Upscale"] },
        { name: "Dear Irving", address: "55 Irving Pl, NY 10003", place_id: "dearirving", location: { lat: 40.7353, lng: -73.9876 }, tags: ["Speakeasy", "Instagrammable"] },
        ],
      },
      pizza: {
        title: 'Popular Pizza Spots',
        aiPlaceholder: "E.g., Best late-night slice in the East Village",
        spots: [
        { name: "Lucali", address: "575 Henry St, Brooklyn", place_id: "lucali", location: { lat: 40.6818, lng: -74.0001 }, tags: ["Whole Pie", "Cash Only"] },
        { name: "Di Fara", address: "1424 Avenue J, Brooklyn", place_id: "difara", location: { lat: 40.625, lng: -73.9614 }, tags: ["Classic", "Slice"] },
        { name: "Joe's Pizza", address: "7 Carmine St, NY 10014", place_id: "joes", location: { lat: 40.7305, lng: -74.0021 }, tags: ["Slice", "New York Style"] },
        { name: "Prince Street Pizza", address: "27 Prince St, NY 10012", place_id: "princestreet", location: { lat: 40.7231, lng: -73.9945 }, tags: ["Sicilian", "Slice"] },
        { name: "L'Industrie", address: "Multiple Locations", place_id: "lindustrie", location: { lat: 40.7116, lng: -73.958 }, tags: ["Slice"] },
        { name: "John's of Bleecker Street", address: "278 Bleecker St, NY 10014", place_id: "johns", location: { lat: 40.7316, lng: -74.0034 }, tags: ["Coal Oven", "Whole Pie"] },
        { name: "Lombardi's", address: "32 Spring St, NY 10012", place_id: "lombardis", location: { lat: 40.7216, lng: -73.9956 }, tags: ["Coal Oven", "Classic"] },
        { name: "Scarr's Pizza", address: "35 Orchard St, NY 10002", place_id: "scarrs", location: { lat: 40.7153, lng: -73.9915 }, tags: ["Slice", "New York Style"] },
        { name: "Una Pizza Napoletana", address: "175 Orchard St, NY 10002", place_id: "unapizza", location: { lat: 40.7215, lng: -73.9884 }, tags: ["Neapolitan", "Wood-Fired"] },
        { name: "Totonno's", address: "1524 Neptune Ave, Brooklyn", place_id: "totonnos", location: { lat: 40.5789, lng: -73.9838 }, tags: ["Coal Oven", "Classic"] },
        { name: "Joe & Pat's", address: "1758 Victory Blvd, Staten Island", place_id: "joeandpats", location: { lat: 40.6129, lng: -74.1218 }, tags: ["Whole Pie", "Classic"] },
        ],
      },
    },
  },
  miami: {
    label: 'Miami',
    name: 'Miami',
    center: [25.79, -80.2],
    fallbackAddress: 'Miami, FL',
    picks: {
      burgers: {
        title: 'Popular Burger Spots',
        aiPlaceholder: "E.g., A late-night burger near Wynwood",
        spots: [
          { name: "Kush", address: "2003 N Miami Ave, Miami, FL 33127", place_id: "miami-kush", location: { lat: 25.7952, lng: -80.1958 }, tags: ["Gastropub", "Classic"] },
          { name: "LoKal", address: "3190 Commodore Plaza, Miami, FL 33133", place_id: "miami-lokal", location: { lat: 25.7281, lng: -80.2433 }, tags: ["Classic", "Hidden Gem"] },
          { name: "Pincho", address: "Multiple Locations", place_id: "miami-pincho", location: { lat: 25.7508, lng: -80.2587 }, tags: ["Chain", "Fast Casual"] },
          { name: "El Rey de las Fritas", address: "1821 SW 8th St, Miami, FL 33135", place_id: "miami-reydelasfritas", location: { lat: 25.7653, lng: -80.2252 }, tags: ["Frita", "No-frills"] },
          { name: "El Mago de las Fritas", address: "5828 SW 8th St, Miami, FL 33144", place_id: "miami-magodelasfritas", location: { lat: 25.7631, lng: -80.2879 }, tags: ["Frita", "Hidden Gem"] },
          { name: "Blue Collar", address: "6730 Biscayne Blvd, Miami, FL 33138", place_id: "miami-bluecollar", location: { lat: 25.8378, lng: -80.1844 }, tags: ["Classic", "No-frills"] },
          { name: "Burger & Beer Joint", address: "1766 Bay Rd, Miami Beach, FL 33139", place_id: "miami-bbjoint", location: { lat: 25.7937, lng: -80.1432 }, tags: ["Gastropub"] },
          { name: "Shake Shack", address: "Multiple Locations", place_id: "miami-shakeshack", location: { lat: 25.7906, lng: -80.1393 }, tags: ["Chain", "Fast Casual"] },
        ],
      },
      martinis: {
        title: 'Popular Martini Spots',
        aiPlaceholder: "E.g., An old-school martini in South Beach",
        spots: [
          { name: "Joe's Stone Crab", address: "11 Washington Ave, Miami Beach, FL 33139", place_id: "miami-joesstonecrab", location: { lat: 25.7686, lng: -80.1343 }, tags: ["Classic", "Upscale"] },
          { name: "The Surf Club Restaurant", address: "9011 Collins Ave, Surfside, FL 33154", place_id: "miami-surfclub", location: { lat: 25.8762, lng: -80.1213 }, tags: ["Hotel Bar", "Upscale"] },
          { name: "Employees Only", address: "1030 Washington Ave, Miami Beach, FL 33139", place_id: "miami-employeesonly", location: { lat: 25.7807, lng: -80.1323 }, tags: ["Speakeasy"] },
          { name: "Café La Trova", address: "971 SW 8th St, Miami, FL 33130", place_id: "miami-cafelatrova", location: { lat: 25.7656, lng: -80.2093 }, tags: ["Classic", "Hidden Gem"] },
          { name: "The Regent Cocktail Club", address: "1690 Collins Ave, Miami Beach, FL 33139", place_id: "miami-regent", location: { lat: 25.7915, lng: -80.1294 }, tags: ["Hotel Bar", "Classic"] },
          { name: "Prime 112", address: "112 Ocean Dr, Miami Beach, FL 33139", place_id: "miami-prime112", location: { lat: 25.7698, lng: -80.1340 }, tags: ["Steakhouse", "Upscale"] },
          { name: "Lost Boy Dry Goods", address: "157 E Flagler St, Miami, FL 33131", place_id: "miami-lostboy", location: { lat: 25.7742, lng: -80.1903 }, tags: ["Dive Bar", "Happy Hour"] },
        ],
      },
      pizza: {
        title: 'Popular Pizza Spots',
        aiPlaceholder: "E.g., A wood-fired pie in the Design District",
        spots: [
          { name: "Lucali", address: "1930 Bay Rd, Miami Beach, FL 33139", place_id: "miami-lucali", location: { lat: 25.7956, lng: -80.1438 }, tags: ["Whole Pie"] },
          { name: "Harry's Pizza", address: "3918 N Miami Ave, Miami, FL 33127", place_id: "miami-harrys", location: { lat: 25.8136, lng: -80.1952 }, tags: ["Wood-Fired"] },
          { name: "Ironside Pizza", address: "7580 NE 4th Ct, Miami, FL 33138", place_id: "miami-ironside", location: { lat: 25.8456, lng: -80.1862 }, tags: ["Neapolitan", "Wood-Fired"] },
          { name: "Andiamo", address: "5600 Biscayne Blvd, Miami, FL 33137", place_id: "miami-andiamo", location: { lat: 25.8264, lng: -80.1846 }, tags: ["Wood-Fired", "Classic"] },
          { name: "Mister O1 Extraordinary Pizza", address: "Multiple Locations", place_id: "miami-mistero1", location: { lat: 25.7869, lng: -80.1318 }, tags: ["Neapolitan"] },
          { name: "Frankie's Pizza", address: "9118 SW 40th St, Miami, FL 33165", place_id: "miami-frankies", location: { lat: 25.7330, lng: -80.3443 }, tags: ["Classic", "Slice"] },
          { name: "Steve's Pizza", address: "12101 Biscayne Blvd, North Miami, FL 33181", place_id: "miami-steves", location: { lat: 25.8857, lng: -80.1658 }, tags: ["Slice", "Late Night"] },
        ],
      },
    },
  },
};

const CITY_KEYS = Object.keys(CITIES);
const isCity = (key) => CITY_KEYS.includes(key);

// The AI Finder calls a small server (ai-search/) that holds the Anthropic API key,
// since a key in this static site would be visible to anyone.
const AI_SEARCH_URL = import.meta.env.VITE_AI_SEARCH_URL;

// The search bar looks spots up on Google Maps through the same server, so every spot is
// an official listing with a real address and one id, however people spell the name.
const PLACES_URL = AI_SEARCH_URL && `${AI_SEARCH_URL.replace(/\/+$/, '')}/places`;

// Reuse a recommended spot's id when the AI suggests it, so leaderboard votes add up.
const placeIdFor = (name, key, city) => {
  const known = CITIES[city].picks[key]?.spots.find(r => r.name.toLowerCase() === name.toLowerCase());
  return known ? known.place_id : `ai-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
};

// Spots saved before search used Google Maps were typed in by hand (custom-…) or named by
// the AI (ai-…), so two people can have the same place under different ids.
const isUnverified = (item) => /^(custom|ai)-/.test(item.place_id || '');

const ALL_RECOMMENDED = CITY_KEYS.flatMap(city => CATEGORY_KEYS.flatMap(key => CITIES[city].picks[key].spots));

// Where to pin a saved spot. Recommended spots saved before they had coordinates use
// the recommended list's.
const locationOf = (item) => item.location || ALL_RECOMMENDED.find(r => r.place_id === item.place_id)?.location || null;
const streetNumber = (address) => (address || '').match(/^\d[\d-]*/)?.[0];

// A Google listing for one of the recommended spots keeps the recommended spot's id, so
// people who added it from the list and people who searched for it are counted together.
// Chains listed as "Multiple Locations" match any branch in the same city.
const toListing = (place, city) => {
  const name = normalize(place.name);
  const known = CATEGORY_KEYS.flatMap(key => CITIES[city].picks[key].spots).find((r) => {
    const rec = normalize(r.name);
    const sameName = name === rec || name.startsWith(`${rec} `) || rec.startsWith(`${name} `);
    if (!sameName) return false;
    return r.address === 'Multiple Locations' || streetNumber(r.address) === streetNumber(place.address);
  });
  if (known) return { place_id: known.place_id, name: known.name, address: known.address, tags: known.tags, location: place.location || known.location };
  return {
    place_id: place.id,
    name: place.name,
    address: place.address,
    ...(place.location && { location: place.location }),
  };
};

// Users saved before categories existed only have a top-level `ranking` (burgers).
const normalizeRankings = (data) => {
  const rankings = { ...(data?.rankings || {}) };
  if (!rankings.burgers && data?.ranking) rankings.burgers = data.ranking;
  CATEGORY_KEYS.forEach((key) => { rankings[key] = rankings[key] || []; });
  return rankings;
};

const countRanked = (rankings) => CATEGORY_KEYS.reduce((sum, key) => sum + rankings[key].length, 0);

// Spots people want to try, one list per category.
const MAX_WANT_TO_TRY = 50;
const normalizeWantToTry = (data) => {
  const lists = { ...(data?.wantToTry || {}) };
  CATEGORY_KEYS.forEach((key) => { lists[key] = Array.isArray(lists[key]) ? lists[key] : []; });
  return lists;
};

// Every city's lists for one user: { nyc: { rankings, wantToTry }, miami: { ... } }. NYC's
// are the original top-level fields, so lists saved before there were cities stay in NYC.
const normalizeLists = (data) => Object.fromEntries(CITY_KEYS.map((city) => {
  const source = city === 'nyc' ? data : data?.cities?.[city];
  return [city, { rankings: normalizeRankings(source), wantToTry: normalizeWantToTry(source) }];
}));

const countAllRanked = (lists) => CITY_KEYS.reduce((sum, city) => sum + countRanked(lists[city].rankings), 0);

const emptyLeaderboards = () => Object.fromEntries(CITY_KEYS.map(city => [city, normalizeRankings(null)]));

// Two lists hold the same place when the listing ids match. Hand-typed spots have one-off
// ids, so those are compared by name.
const placeKey = (item) => (item.place_id && !isUnverified(item) ? item.place_id : `name:${normalize(item.name || '')}`);
const hasPlace = (list, item) => list.some((other) => placeKey(other) === placeKey(item));

// How many places both you and one person you follow want to try, across all categories.
const sharedWantCount = (mine, theirs) =>
  CATEGORY_KEYS.reduce((sum, key) => sum + mine[key].filter((item) => hasPlace(theirs[key], item)).length, 0);

export default function NYCBurgerRanker() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  // The place_id of a hand-typed spot being swapped for its official listing.
  const [replacingId, setReplacingId] = useState(null);
  const [category, setCategory] = useState('burgers');
  const [city, setCity] = useState('nyc');
  // The city the app opens to, chosen by each user.
  const [homeCity, setHomeCity] = useState('nyc');
  const [lists, setLists] = useState(() => normalizeLists(null));
  const [leaderboards, setLeaderboards] = useState(emptyLeaderboards);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragSource, setDragSource] = useState(null);
  const [view, setView] = useState('ranking'); // 'ranking', 'wantToTry', 'map', 'leaderboard', 'following', 'profile'
  // Which kinds of pins the map shows.
  const [mapLayers, setMapLayers] = useState({ ranked: true, want: true, follows: true });
  const [submitted, setSubmitted] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState({});
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiSearchResults, setAiSearchResults] = useState([]);
  const [aiSearchMessage, setAiSearchMessage] = useState('');
  // Bumped on each search and on close, so a late answer can't reopen closed results.
  const aiSearchIdRef = useRef(0);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [showRecommended, setShowRecommended] = useState(true);
  const [selectedTags, setSelectedTags] = useState([]);
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  
  // User profile & social features
  const [username, setUsername] = useState('');
  // False for older username-only accounts, which are asked to add an email for password resets.
  const [hasEmail, setHasEmail] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState({ busy: false, error: '', sentTo: '' });
  const [initError, setInitError] = useState('');
  const [saveStatus, setSaveStatus] = useState(''); // '', 'saving', 'saved', 'error'
  // JSON of the lists as last loaded or saved; null until the signed-in user's lists have loaded.
  const lastSavedRankingsRef = useRef(null);
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);

  const cat = CATEGORIES[category];
  const cityInfo = CITIES[city];
  const picks = cityInfo.picks[category];
  // The open city's lists. The setters take a new value or an updater function, like useState's.
  const { rankings, wantToTry } = lists[city];
  const updateCityList = (field) => (update) => setLists(prev => ({
    ...prev,
    [city]: { ...prev[city], [field]: typeof update === 'function' ? update(prev[city][field]) : update },
  }));
  const setRankings = updateCityList('rankings');
  const setWantToTry = updateCityList('wantToTry');
  const rankedItems = rankings[category];
  const setRankedItems = (items) => setRankings(prev => ({ ...prev, [category]: items }));
  const leaderboard = leaderboards[city][category];
  const wantList = wantToTry[category];
  const submittedKey = `${city}_${category}`;

  const switchCategory = (key) => {
    setCategory(key);
    setSearchResults([]);
    setSearchQuery('');
    setSearchMessage('');
    setReplacingId(null);
    setSelectedTags([]);
    setDraggedIndex(null);
    setDragSource(null);
  };

  const switchCity = (key) => {
    if (key === city) return;
    switchCategory(category);
    clearAiSearch();
    setCity(key);
  };

  const makeHomeCity = async () => {
    setHomeCity(city);
    try {
      await saveHomeCity(userId, city);
    } catch (error) {
      console.error('Error saving default city:', error);
    }
  };

  useEffect(() => {
    let unsubscribe = null;
    let cancelled = false;

    watchAuth(async (user) => {
      if (!user) {
        resetUserState();
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setHasEmail(user.hasEmail);
      await loadData(user);
    })
      .then((unsub) => {
        if (cancelled) unsub();
        else unsubscribe = unsub;
      })
      .catch((error) => {
        console.error('Firebase initialization error:', error);
        setInitError('Could not connect to the database. Please check your connection and Firebase configuration.');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Save lists automatically shortly after each change, so they are there on the next visit.
  useEffect(() => {
    if (!userId || lastSavedRankingsRef.current === null) return;
    const serialized = JSON.stringify(lists);
    if (serialized === lastSavedRankingsRef.current) return;

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveLists(userId, JSON.parse(serialized));
        lastSavedRankingsRef.current = serialized;
        setSaveStatus('saved');
      } catch (error) {
        console.error('Error saving lists:', error);
        setSaveStatus('error');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [lists, userId]);

  const resetUserState = () => {
    lastSavedRankingsRef.current = null;
    setUserId(null);
    setUsername('');
    setHasEmail(true);
    setNewEmail('');
    setEmailStatus({ busy: false, error: '', sentTo: '' });
    setLists(normalizeLists(null));
    setCity('nyc');
    setHomeCity('nyc');
    setSubmitted({});
    setFollowing([]);
    setFollowers([]);
    setAllUsers([]);
    setSelectedUserProfile(null);
    setSaveStatus('');
    setView('ranking');
    switchCategory('burgers');
  };

  const loadData = async (user) => {
    try {
      const { db: firestore } = await getFirebase();
      setDb(firestore);

      let profile = await loadUser(user.uid);
      if (!profile) {
        // Sign-up was interrupted before the profile was written.
        await createProfile(user.uid, user.username);
        profile = await loadUser(user.uid);
      }

      const loadedLists = normalizeLists(profile);
      lastSavedRankingsRef.current = JSON.stringify(loadedLists);
      setLists(loadedLists);
      const home = isCity(profile?.homeCity) ? profile.homeCity : 'nyc';
      setHomeCity(home);
      setCity(home);
      setUsername(profile?.username || user.username);
      setFollowing(profile?.following || []);
      setUserId(user.uid);

      await Promise.all([
        loadAllUsers(),
        loadFollowers(user.uid),
        updateLeaderboard(firestore),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setInitError(databaseErrorMessage(error));
    }
    setIsLoading(false);
  };

  const loadAllUsers = async () => {
    try {
      const users = await fetchAllUsers();
      setAllUsers(users.map((data) => {
        const userLists = normalizeLists(data);
        return {
          userId: data.userId,
          username: data.username,
          lists: userLists,
          rankingCount: countAllRanked(userLists),
          updatedAt: data.updatedAt,
        };
      }));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadFollowers = async (uid) => {
    try {
      setFollowers(await fetchFollowers(uid));
    } catch (error) {
      console.error('Error loading followers:', error);
    }
  };

  const handleLogOut = async () => {
    try {
      // Flush an autosave that hasn't fired yet so nothing is lost.
      const serialized = JSON.stringify(lists);
      if (lastSavedRankingsRef.current !== null && serialized !== lastSavedRankingsRef.current) {
        await saveLists(userId, lists);
      }
      await logOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleAddEmail = async (e) => {
    e.preventDefault();
    setEmailStatus({ busy: true, error: '', sentTo: '' });
    try {
      await addEmail(newEmail);
      setEmailStatus({ busy: false, error: '', sentTo: newEmail.trim() });
    } catch (error) {
      setEmailStatus({ busy: false, error: error.message, sentTo: '' });
    }
  };

  const followUser = async (targetUserId) => {
    if (!userId || targetUserId === userId) return;

    try {
      await saveFollowing(userId, targetUserId, true);
      setFollowing(prev => (prev.includes(targetUserId) ? prev : [...prev, targetUserId]));
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  const unfollowUser = async (targetUserId) => {
    if (!userId) return;

    try {
      await saveFollowing(userId, targetUserId, false);
      setFollowing(prev => prev.filter(id => id !== targetUserId));
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  };

  const viewUserProfile = async (targetUserId) => {
    try {
      const data = await loadUser(targetUserId);
      if (data) {
        setSelectedUserProfile({
          userId: targetUserId,
          username: data.username,
          lists: normalizeLists(data),
          updatedAt: data.updatedAt,
        });
        setView('profile');
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const updateLeaderboard = async (firestore) => {
    try {
      const { collection, getDocs } = await loadFirestoreSdk();
      
      const submissionsRef = collection(firestore, 'submissions');
      const snapshot = await getDocs(submissionsRef);
      
      const scoresByCity = {};
      CITY_KEYS.forEach((c) => {
        scoresByCity[c] = {};
        CATEGORY_KEYS.forEach((key) => { scoresByCity[c][key] = {}; });
      });
      snapshot.forEach((doc) => {
        const submission = doc.data();
        // Submissions saved before cities existed are NYC's, and before categories existed
        // they are burger rankings.
        const burgerScores = scoresByCity[submission.city || 'nyc']?.[submission.category || 'burgers'];
        if (!burgerScores) return;
        // A list counts once per spot and only its top 10, with ratings kept to 1-5 stars,
        // so an edited submission can't stuff the leaderboard.
        const counted = new Set();
        (submission.items || submission.burgers)?.slice(0, 10).forEach((burger, index) => {
          if (!burger?.name) return;
          // Hand-typed spots have a one-off id each, so count them by name instead.
          const placeId = burger.place_id && !isUnverified(burger) ? burger.place_id : `name:${normalize(burger.name)}`;
          if (counted.has(placeId)) return;
          counted.add(placeId);
          if (!burgerScores[placeId]) {
            burgerScores[placeId] = {
              name: burger.name,
              address: burger.address,
              place_id: burger.place_id,
              totalPoints: 0,
              totalRatings: 0,
              submissions: 0,
              comments: [],
              tags: burger.tags || [],
            };
          }
          
          const points = 10 - index;
          burgerScores[placeId].totalPoints += points;
          burgerScores[placeId].totalRatings += Math.min(5, Math.max(1, Number(burger.rating) || 1));
          burgerScores[placeId].submissions += 1;
          
          if (burger.comments?.trim()) {
            burgerScores[placeId].comments.push(burger.comments.trim());
          }
        });
      });

      const leaderboardData = emptyLeaderboards();
      CITY_KEYS.forEach((c) => CATEGORY_KEYS.forEach((key) => {
        leaderboardData[c][key] = Object.values(scoresByCity[c][key])
          .map((burger) => ({
            ...burger,
            avgRating: (burger.totalRatings / burger.submissions).toFixed(1),
          }))
          .sort((a, b) => b.totalPoints - a.totalPoints)
          .slice(0, 20);
      }));

      setLeaderboards(leaderboardData);
    } catch (error) {
      console.error('Error updating leaderboard:', error);
    }
  };

  const clearAiSearch = () => {
    aiSearchIdRef.current += 1;
    setIsAiSearching(false);
    setAiSearchQuery('');
    setAiSearchResults([]);
    setAiSearchMessage('');
  };

  const handleAiSearch = async () => {
    if (!aiSearchQuery.trim()) return;
    setAiSearchResults([]);
    setAiSearchMessage('');
    if (!AI_SEARCH_URL) {
      setAiSearchMessage("AI search isn't switched on for this site yet. Use the search bar or the recommended spots below.");
      return;
    }
    setIsAiSearching(true);
    const searchId = ++aiSearchIdRef.current;

    try {
      const response = await fetch(AI_SEARCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiSearchQuery, city }),
      });
      const data = await response.json().catch(() => ({}));
      if (searchId !== aiSearchIdRef.current) return;
      if (!response.ok) throw new Error(data.error || `AI search failed (${response.status})`);
      // With Google Maps switched on, the server attaches each spot's official listing.
      const results = (data.results || []).map(r => (r.placeId ? {
        ...r,
        ...toListing({ id: r.placeId, name: r.name, address: r.address, location: r.location }, city),
      } : {
        ...r,
        place_id: placeIdFor(r.name, r.category, city),
        address: r.address || r.neighborhood || cityInfo.fallbackAddress,
      }));
      setAiSearchResults(results);
      if (results.length === 0) setAiSearchMessage('No matches for that one. Try describing it another way.');
    } catch (error) {
      if (searchId !== aiSearchIdRef.current) return;
      console.error('AI search error:', error);
      setAiSearchMessage(`${error.message}. Try the search bar or browse recommended spots below.`);
    }
    setIsAiSearching(false);
  };

  // Only official listings can be added, never the typed text, so "4 Charles" and
  // "4 Charles Prime" both end up as the same place.
  const searchBurgers = async (query = searchQuery) => {
    const q = query.trim();
    if (!q) return;
    setIsSearching(true);
    setSearchResults([]);
    setSearchMessage('');

    let results = [];
    if (PLACES_URL) {
      try {
        const response = await fetch(PLACES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, city }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Search failed (${response.status})`);
        const seen = new Set();
        results = (data.places || []).map(p => toListing(p, city)).filter((p) => !seen.has(p.place_id) && seen.add(p.place_id));
        if (results.length === 0) setSearchMessage(`No restaurants or bars in ${cityInfo.name} match "${q}". Try the name as it appears on Google Maps.`);
      } catch (error) {
        console.error('Place search error:', error);
        results = fuzzySearch(picks.spots, q);
        setSearchMessage(`${error.message} ${results.length ? 'Showing matching recommended spots instead.' : 'Try again, or pick from the recommended spots below.'}`);
      }
    } else {
      results = fuzzySearch(picks.spots, q);
      setSearchMessage(`Google Maps search isn't switched on for this site yet, so only the recommended spots can be searched.${results.length ? '' : ` None of them match "${q}".`}`);
    }

    setSearchResults(results);
    setIsSearching(false);
  };

  // Searches for a hand-typed spot so it can be swapped for its official listing.
  const startMatching = (item) => {
    setReplacingId(item.place_id);
    setSearchQuery(item.name);
    searchBurgers(item.name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelMatching = () => {
    setReplacingId(null);
    setSearchResults([]);
    setSearchMessage('');
    setSearchQuery('');
  };

  // Swaps the hand-typed spot for the chosen listing, keeping its rank, stars and notes.
  const replaceWithListing = (place) => {
    if (rankedItems.some(b => b.place_id === place.place_id)) {
      alert(`${place.name} is already in your ranking. Remove the old entry with the bin button instead.`);
      return;
    }
    setRankedItems(rankedItems.map(b => (b.place_id === replacingId ? {
      ...b,
      place_id: place.place_id,
      name: place.name,
      address: place.address,
      tags: b.tags?.length ? b.tags : place.tags || [],
      ...(place.location && { location: place.location }),
    } : b)));
    cancelMatching();
  };

  // Adds a spot to one of the lists (the open one unless another is named).
  const addToList = (place, key = category) => {
    const list = rankings[key];
    const target = CATEGORIES[key];
    if (list.length >= 10) {
      alert(`You can only rank 10 ${target.plural}!`);
      return false;
    }
    if (list.some(b => b.place_id === place.place_id)) {
      alert(`This ${target.singular} is already in your ranking!`);
      return false;
    }

    setRankings(prev => ({ ...prev, [key]: [...prev[key], {
      place_id: place.place_id,
      name: place.name,
      address: place.address,
      rating: 5,
      comments: '',
      tags: place.tags || [],
      ...(place.location && { location: place.location }),
    }] }));
    // Once it's ranked it has been tried, so it comes off the want-to-try list.
    setWantToTry(prev => ({ ...prev, [key]: prev[key].filter(w => placeKey(w) !== placeKey(place)) }));
    return true;
  };

  // Saves a spot to the want-to-try list for a category (the open one unless another is named).
  const addToWantToTry = (place, key = category) => {
    const target = CATEGORIES[key];
    if (hasPlace(rankings[key], place)) {
      alert(`${place.name} is already in your ${target.label.toLowerCase()} ranking, so you've tried it!`);
      return false;
    }
    if (hasPlace(wantToTry[key], place)) {
      alert(`${place.name} is already on your want-to-try list.`);
      return false;
    }
    if (wantToTry[key].length >= MAX_WANT_TO_TRY) {
      alert(`Your want-to-try list holds up to ${MAX_WANT_TO_TRY} ${target.plural}. Remove one to add another.`);
      return false;
    }
    setWantToTry(prev => ({ ...prev, [key]: [...prev[key], {
      place_id: place.place_id,
      name: place.name,
      address: place.address,
      tags: place.tags || [],
      ...(place.location && { location: place.location }),
      addedAt: new Date().toISOString(),
    }] }));
    return true;
  };

  const removeFromWantToTry = (place) => {
    setWantToTry(prev => ({ ...prev, [category]: prev[category].filter(w => placeKey(w) !== placeKey(place)) }));
  };

  // "Tried it": moves the spot into the ranking so it can be rated.
  const markTried = (place) => {
    if (!addToList(place)) return;
    setView('ranking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveSearchResultForLater = (place) => {
    if (!addToWantToTry(place)) return;
    setSearchResults([]);
    setSearchMessage('');
    setSearchQuery('');
  };

  // The search box is shared by the ranking and want-to-try pages, so leftover results are
  // cleared when moving between pages.
  const openView = (key) => {
    if (key !== view) {
      setSearchResults([]);
      setSearchMessage('');
      setSearchQuery('');
      setReplacingId(null);
    }
    setView(key);
    // Pick up spots people you follow added since you signed in.
    if (key === 'wantToTry' || key === 'map' || key === 'following') loadAllUsers();
    // And anyone who followed you since then.
    if (key === 'following' && userId) loadFollowers(userId);
  };

  // The header counts open the Following page at the matching list.
  const showPeople = (sectionId) => {
    openView('following');
    setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const addBurger = (place) => {
    if (!addToList(place)) return;
    setSearchResults([]);
    setSearchMessage('');
    setSearchQuery('');
  };

  const removeBurger = (index) => {
    setRankedItems(rankedItems.filter((_, i) => i !== index));
  };

  const updateBurger = (index, field, value) => {
    const updated = [...rankedItems];
    updated[index][field] = value;
    setRankedItems(updated);
  };

  const handleDragStart = (index, source = 'ranked') => {
    setDraggedIndex(index);
    setDragSource(source);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (dragSource !== 'ranked' || draggedIndex === null || draggedIndex === index) return;
    const items = [...rankedItems];
    const draggedItem = items[draggedIndex];
    items.splice(draggedIndex, 1);
    items.splice(index, 0, draggedItem);
    setRankedItems(items);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragSource(null);
  };

  const handleDropFromRecommended = (e, targetIndex) => {
    e.preventDefault();
    if (dragSource !== 'recommended' || draggedIndex === null) return;

    const burger = picks.spots[draggedIndex];
    if (rankedItems.length >= 10) {
      alert(`You can only rank 10 ${cat.plural}!`);
      handleDragEnd();
      return;
    }
    if (rankedItems.some(b => b.place_id === burger.place_id)) {
      alert(`This ${cat.singular} is already in your ranking!`);
      handleDragEnd();
      return;
    }

    const items = [...rankedItems];
    items.splice(targetIndex, 0, { ...burger, rating: 5, comments: '' });
    setRankedItems(items);
    setWantToTry(prev => ({ ...prev, [category]: prev[category].filter(w => placeKey(w) !== placeKey(burger)) }));
    handleDragEnd();
  };

  const saveRanking = async () => {
    if (rankedItems.length === 0) {
      alert(`Please add at least one ${cat.singular}!`);
      return;
    }

    if (!userId) {
      alert('Please log in first!');
      return;
    }

    try {
      await saveLists(userId, lists);
      lastSavedRankingsRef.current = JSON.stringify(lists);
      await submitRanking(userId, username, city, category, rankedItems);

      setSubmitted(prev => ({ ...prev, [submittedKey]: true }));
      await updateLeaderboard(db);
      setTimeout(() => setView('leaderboard'), 1000);
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error saving ranking. Please try again.');
    }
  };

  // Shared bistro styles.
  const panel = 'bg-card border border-line rounded-sm p-6';
  const eyebrow = 'text-[11px] uppercase tracking-[0.2em] text-brass font-semibold';
  const heading = 'font-display text-2xl text-ink';
  const input = 'w-full px-4 py-3 bg-white/70 border border-line rounded-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine';
  const primaryButton = 'bg-wine text-paper rounded-sm uppercase tracking-wider text-xs font-semibold hover:bg-wine-dark transition-colors disabled:bg-ink-muted';
  const quietButton = 'border border-line text-ink-soft rounded-sm uppercase tracking-wider text-xs font-semibold hover:border-ink-soft hover:text-ink transition-colors';
  const chip = 'text-[11px] border border-line text-ink-soft px-2 py-0.5 rounded-sm';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="font-display italic text-4xl text-wine mb-2">Top Shelf</div>
          <div className={eyebrow}>Loading</div>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className={`${panel} p-8 max-w-md w-full text-center`}>
          <p className="text-ink-soft">{initError}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => window.location.reload()} className={`${primaryButton} px-5 py-3`}>
              Try again
            </button>
            <button
              onClick={async () => { await logOut().catch(() => {}); setInitError(''); }}
              className={`${quietButton} px-5 py-3`}
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!userId) {
    return <AuthScreen />;
  }

  const filteredLeaderboard = selectedTags.length > 0
    ? leaderboard.filter(burger =>
        burger.tags.some(tag => selectedTags.includes(tag))
      )
    : leaderboard;

  const filteredUsers = userSearchQuery.trim()
    ? allUsers.filter(u =>
        u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) &&
        u.userId !== userId
      )
    : allUsers.filter(u => u.userId !== userId);

  // People you follow, with their lists for the open city.
  const followingUsers = allUsers
    .filter(u => following.includes(u.userId))
    .map(u => ({ ...u, ...u.lists[city] }));
  // Followers with their ranking counts when we have them.
  const followerUsers = followers.map(f => allUsers.find(u => u.userId === f.userId) || { ...f, rankingCount: 0 });

  // For each spot on your want-to-try list: who you follow also wants to try it, and who
  // has already ranked it (and where).
  const wantConnections = wantList.map((item) => ({
    item,
    alsoWant: followingUsers.filter(u => hasPlace(u.wantToTry[category], item)).map(u => u.username),
    rankedBy: followingUsers.flatMap((u) => {
      const index = u.rankings[category].findIndex(ranked => placeKey(ranked) === placeKey(item));
      return index >= 0 ? [{ username: u.username, rank: index + 1 }] : [];
    }),
  }));
  const sharedCount = wantConnections.filter(c => c.alsoWant.length > 0).length;

  // Spots people you follow want to try that aren't on your lists yet, most wanted first.
  const followsWant = Object.values(followingUsers.reduce((byPlace, u) => {
    u.wantToTry[category].forEach((item) => {
      if (hasPlace(wantList, item) || hasPlace(rankedItems, item)) return;
      const key = placeKey(item);
      byPlace[key] = byPlace[key] || { item, usernames: [] };
      if (!byPlace[key].usernames.includes(u.username)) byPlace[key].usernames.push(u.username);
    });
    return byPlace;
  }, {})).sort((a, b) => b.usernames.length - a.usernames.length || a.item.name.localeCompare(b.item.name));

  const listNames = (names) => names.map(n => `@${n}`).join(', ');

  // Map pins for this category: one per place, gathering everything known about it. A pin
  // takes the colour of the most personal list it is on (your ranking, then your
  // want-to-try list, then people you follow) among the layers switched on.
  const mapPlaces = new Map();
  const noteOnMap = (item, kind, detail, username) => {
    const location = locationOf(item);
    if (!location) return false;
    const key = placeKey(item);
    if (!mapPlaces.has(key)) {
      mapPlaces.set(key, { key, lat: location.lat, lng: location.lng, name: item.name, address: item.address, kinds: new Set(), details: [], rank: null, usernames: new Set() });
    }
    const place = mapPlaces.get(key);
    place.kinds.add(kind);
    place.details.push(detail);
    if (username) place.usernames.add(username);
    return place;
  };
  const unmappedCount = [
    ...rankedItems.map((item, index) => {
      const place = noteOnMap(item, 'ranked', `Your #${index + 1} · ${item.rating} of 5 stars`);
      if (place) place.rank = index + 1;
      return place;
    }),
    ...wantList.map(item => noteOnMap(item, 'want', 'On your want-to-try list')),
  ].filter(place => !place).length;
  followingUsers.forEach((u) => {
    u.rankings[category].forEach((item, index) => noteOnMap(item, 'follows', `@${u.username} ranked it #${index + 1}`, u.username));
    u.wantToTry[category].forEach(item => noteOnMap(item, 'follows', `@${u.username} wants to try it`, u.username));
  });
  const mapPins = [...mapPlaces.values()].flatMap((place) => {
    const kind = ['ranked', 'want', 'follows'].find(k => mapLayers[k] && place.kinds.has(k));
    if (!kind) return [];
    const label = kind === 'ranked' ? String(place.rank) : kind === 'want' ? 'Try' : String(place.usernames.size);
    return [{ key: place.key, lat: place.lat, lng: place.lng, kind, label, name: place.name, address: place.address, details: place.details }];
  });
  const layerCounts = ['ranked', 'want', 'follows'].reduce((counts, k) => ({
    ...counts,
    [k]: [...mapPlaces.values()].filter(place => place.kinds.has(k)).length,
  }), {});

  // Search for official listings, used by both the ranking and want-to-try pages.
  const searchPanel = (
    <div className={panel}>
      <div className={`${eyebrow} mb-3`}>{view === 'wantToTry' ? 'Find a spot to try' : 'Find a spot'}</div>
      {replacingId && (
        <div className="mb-3 text-sm text-ink-soft bg-wine-light border border-wine/20 rounded-sm px-3 py-2 flex items-center justify-between gap-3">
          <span>Pick the official listing to replace the one you typed.</span>
          <button onClick={cancelMatching} className="text-xs uppercase tracking-wider text-wine hover:text-wine-dark">Cancel</button>
        </div>
      )}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3.5 text-ink-muted w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchBurgers()}
            maxLength={300}
            placeholder={`${cat.searchPlaceholder} ${cityInfo.label}...`}
            className={`${input} pl-9`}
          />
        </div>
        <button
          onClick={() => searchBurgers()}
          disabled={isSearching}
          className={`${primaryButton} px-5`}
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {searchMessage && <p className="mt-3 text-sm italic text-ink-muted">{searchMessage}</p>}

      {searchResults.length > 0 && (
        <div className="mt-4 divide-y divide-line border-y border-line">
          {searchResults.map((place) => (
            <div key={place.place_id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex-1">
                <div className="font-display text-lg text-ink">{place.name}</div>
                <div className="text-sm text-ink-muted flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {place.address}
                </div>
              </div>
              {view === 'wantToTry' ? (
                <button
                  onClick={() => saveSearchResultForLater(place)}
                  className={`${primaryButton} shrink-0 px-4 py-2 flex items-center gap-1`}
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />Want to try
                </button>
              ) : (
                <div className="shrink-0 flex items-center gap-2">
                  {!replacingId && (
                    <button
                      onClick={() => saveSearchResultForLater(place)}
                      aria-label={`Save ${place.name} to want to try`}
                      title="Save to want to try"
                      className={`${quietButton} p-2`}
                    >
                      <BookmarkPlus className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => (replacingId ? replaceWithListing(place) : addBurger(place))}
                    className={`${primaryButton} px-4 py-2 flex items-center gap-1`}
                  >
                    {replacingId ? 'Use this' : <><Plus className="w-3.5 h-3.5" />Add</>}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const views = [
    { key: 'ranking', label: 'My Ranking' },
    { key: 'wantToTry', label: 'Want to Try' },
    { key: 'map', label: 'Map' },
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'following', label: `Following (${following.length})` },
  ];

  return (
    <div className="min-h-screen px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <header className="relative text-center pt-20 sm:pt-12 pb-8">
          {/* Which city's lists, leaderboard and map are showing. */}
          <div className="absolute left-0 top-4 flex flex-col items-start gap-1">
            <div className="inline-flex border border-line rounded-sm bg-card p-0.5" role="group" aria-label="City">
              {CITY_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => switchCity(key)}
                  aria-pressed={city === key}
                  className={`px-3 py-1.5 rounded-sm uppercase tracking-wider text-xs font-semibold transition-colors ${
                    city === key ? 'bg-wine text-paper' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {CITIES[key].label}
                </button>
              ))}
            </div>
            {city === homeCity ? (
              <span className="text-[11px] text-ink-muted flex items-center gap-1">
                <Check className="w-3 h-3" />
                Opens here by default
              </span>
            ) : (
              <button onClick={makeHomeCity} className="text-[11px] text-wine hover:text-wine-dark underline underline-offset-2">
                Open to {cityInfo.label} by default
              </button>
            )}
          </div>
          <div className={eyebrow}>{cityInfo.name}</div>
          <h1 className="font-display italic text-6xl sm:text-7xl text-wine mt-2">Top Shelf</h1>
          <div className="flex items-center justify-center gap-3 mt-4" aria-hidden="true">
            <span className="h-px w-16 bg-brass" />
            <span className="text-brass text-xs">◆</span>
            <span className="h-px w-16 bg-brass" />
          </div>
          <p className="font-display italic text-lg text-ink-soft mt-4">The city's finest burgers, martinis and pizza, ranked by you</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            <span className="font-semibold text-ink">@{username}</span>
            <span>·</span>
            <button onClick={() => showPeople('people-you-follow')} className="hover:text-wine underline-offset-2 hover:underline">
              {following.length} following
            </button>
            <span>·</span>
            <button onClick={() => showPeople('your-followers')} className="hover:text-wine underline-offset-2 hover:underline">
              {followers.length} {followers.length === 1 ? 'follower' : 'followers'}
            </button>
            <span>·</span>
            <button onClick={handleLogOut} className="hover:text-wine flex items-center gap-1">
              <LogOut className="w-3.5 h-3.5" />
              Log out
            </button>
          </div>
          {!hasEmail && !isDemoMode && (
            <div className="mt-5 mx-auto max-w-lg p-4 bg-brass-light border border-brass/40 rounded-sm text-sm text-ink-soft text-left">
              {emailStatus.sentTo ? (
                <p role="status">
                  We sent a confirmation link to <strong>{emailStatus.sentTo}</strong>. Click it to add the email
                  to your account. After that, log in with your email instead of your username.
                </p>
              ) : (
                <form onSubmit={handleAddEmail}>
                  <label htmlFor="add-email" className="block mb-2">
                    Add an email so you can reset your password if you ever forget it.
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="add-email"
                      type="email"
                      autoComplete="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={`${input} py-2`}
                      required
                    />
                    <button type="submit" disabled={emailStatus.busy} className={`${primaryButton} px-4 shrink-0`}>
                      {emailStatus.busy ? 'Sending...' : 'Add email'}
                    </button>
                  </div>
                  {emailStatus.error && <p className="mt-2 text-wine" role="alert">{emailStatus.error}</p>}
                </form>
              )}
            </div>
          )}
          {saveStatus && (
            <div className={`mt-1 text-xs ${saveStatus === 'error' ? 'text-wine' : 'text-ink-muted'}`}>
              {saveStatus === 'saving' && 'Saving your lists...'}
              {saveStatus === 'saved' && 'All changes saved'}
              {saveStatus === 'error' && 'Could not save your lists. Check your connection.'}
            </div>
          )}
        </header>

        <nav className="border-y border-line mb-8">
          {view !== 'following' && (
            <div className="flex justify-center gap-6 sm:gap-10 pt-4">
              {CATEGORY_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => switchCategory(key)}
                  className={`font-display text-xl sm:text-2xl pb-1 border-b-2 transition-colors ${
                    category === key ? 'text-wine border-wine italic' : 'text-ink-soft border-transparent hover:text-ink'
                  }`}
                >
                  {CATEGORIES[key].label}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 sm:gap-x-10 py-3">
            {views.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => openView(key)}
                className={`uppercase tracking-[0.18em] text-xs font-semibold whitespace-nowrap py-1 transition-colors ${
                  view === key ? 'text-wine' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        {view === 'ranking' && (
          <div className="grid gap-6 lg:gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
            <div className="space-y-6">
            {searchPanel}

            {/* AI Search */}
            <div className="bg-vert-light border border-vert/30 rounded-sm p-6">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-vert" />
                <h3 className="font-display text-xl text-vert">Ask the maître d'</h3>
                {(aiSearchResults.length > 0 || aiSearchMessage) && (
                  <button
                    onClick={clearAiSearch}
                    className="ml-auto shrink-0 text-xs uppercase tracking-wider text-vert hover:text-vert-dark flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Close
                  </button>
                )}
              </div>
              <p className="text-sm italic text-ink-soft mb-3">Describe what you're after, for burgers, martinis or pizza anywhere in the city.</p>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={aiSearchQuery}
                  onChange={(e) => (e.target.value ? setAiSearchQuery(e.target.value) : clearAiSearch())}
                  onKeyPress={(e) => e.key === 'Enter' && handleAiSearch()}
                  onKeyDown={(e) => e.key === 'Escape' && clearAiSearch()}
                  placeholder={picks.aiPlaceholder}
                  maxLength={300}
                  className={`${input} focus:ring-vert focus:border-vert`}
                />
                <button
                  onClick={handleAiSearch}
                  disabled={isAiSearching}
                  className="bg-vert text-paper rounded-sm uppercase tracking-wider text-xs font-semibold px-5 hover:bg-vert-dark disabled:bg-ink-muted whitespace-nowrap"
                >
                  {isAiSearching ? 'Thinking...' : 'Ask'}
                </button>
              </div>
              {aiSearchMessage && (
                <div className="bg-card p-4 rounded-sm border border-vert/20">
                  <p className="text-sm text-ink-soft">{aiSearchMessage}</p>
                </div>
              )}
              {aiSearchResults.length > 0 && (
                <div className="divide-y divide-vert/20 border-y border-vert/20">
                  {aiSearchResults.map((place) => {
                    const target = CATEGORIES[place.category];
                    return (
                      <div key={place.place_id} className="py-3 flex items-start justify-between gap-3">
                        <div>
                          {target && <div className="text-[11px] uppercase tracking-[0.18em] text-vert font-semibold">{target.label}</div>}
                          <p className="font-display text-lg text-ink leading-tight">
                            {place.name}
                            <span className="font-sans text-sm text-ink-muted"> · {place.neighborhood}</span>
                          </p>
                          <p className="text-sm italic text-ink-soft">{place.why}</p>
                          <p className="text-xs text-ink-muted mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{place.address}</p>
                        </div>
                        {target && (
                          <button
                            onClick={() => addToList(place, place.category)}
                            className="shrink-0 border border-vert text-vert rounded-sm uppercase tracking-wider text-[11px] font-semibold px-3 py-2 hover:bg-vert hover:text-paper transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add to {target.label}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recommended */}
            <div className={panel}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <h3 className={heading}>{picks.title}</h3>
                <button onClick={() => setShowRecommended(!showRecommended)} className="shrink-0 text-xs uppercase tracking-wider text-wine hover:text-wine-dark">
                  {showRecommended ? 'Hide' : 'Show'}
                </button>
              </div>
              {showRecommended && (
                <div>
                  <p className="text-sm italic text-ink-muted mb-4">Drag these into your ranking, or tap + to add.</p>
                  <div className="divide-y divide-line border-y border-line max-h-96 lg:max-h-[34rem] overflow-y-auto">
                    {picks.spots.map((burger, idx) => (
                      <div
                        key={idx}
                        draggable
                        onDragStart={() => handleDragStart(idx, 'recommended')}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center justify-between py-3 px-2 cursor-move transition-colors ${
                          dragSource === 'recommended' && draggedIndex === idx
                            ? 'bg-wine-light'
                            : 'hover:bg-paper'
                        }`}
                      >
                        <div className="flex-1 flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-line" />
                          <div>
                            <div className="font-display text-lg text-ink leading-tight">{burger.name}</div>
                            <div className="text-xs text-ink-muted">{burger.address}</div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {burger.source && (
                                <span className="text-[11px] italic text-wine px-0.5">{burger.source}</span>
                              )}
                              {burger.tags.slice(0, 2).map((tag, i) => (
                                <span key={i} className={chip}>{tag}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => addBurger(burger)}
                          aria-label={`Add ${burger.name}`}
                          className="w-8 h-8 flex items-center justify-center border border-wine text-wine rounded-full hover:bg-wine hover:text-paper transition-colors ml-2"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            </div>

            {/* Ranked List */}
            <div>
            <div className={panel}>
              <div className={eyebrow}>{rankedItems.length} of 10 ranked</div>
              <h2 className="font-display text-3xl text-ink mt-1 mb-5">Your Top {cat.label}</h2>

              {rankedItems.length === 0 ? (
                <div
                  className="text-center py-16 border border-dashed border-line rounded-sm text-ink-muted"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => dragSource === 'recommended' && handleDropFromRecommended(e, 0)}
                >
                  <div className="font-display italic text-2xl text-ink-soft mb-2">Your list is empty</div>
                  <p className="text-sm">Drag {cat.plural} from the recommended list or search to add them.</p>
                </div>
              ) : (
                <div
                  className="divide-y divide-line border-y border-line"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => dragSource === 'recommended' && handleDropFromRecommended(e, rankedItems.length)}
                >
                  {rankedItems.map((burger, index) => (
                    <div
                      key={index}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`py-5 px-2 cursor-move transition-colors ${
                        draggedIndex === index && dragSource === 'ranked'
                          ? 'bg-wine-light'
                          : 'hover:bg-paper/60'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
                          <div className="font-display italic text-4xl leading-none text-wine">{index + 1}</div>
                          <GripVertical className="w-4 h-4 text-line" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-3">
                          <div>
                            <div className="font-display text-xl text-ink">{burger.name}</div>
                            <div className="text-sm text-ink-muted flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" />
                              {burger.address}
                            </div>
                            {isUnverified(burger) && PLACES_URL && (
                              <button
                                onClick={() => startMatching(burger)}
                                className="mt-1 text-xs text-wine hover:text-wine-dark underline underline-offset-2"
                              >
                                Typed in by hand. Match it to the official listing
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                            <div className="flex gap-0.5" aria-label="Rating">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button key={star} onClick={() => updateBurger(index, 'rating', star)} aria-label={`${star} stars`}>
                                  <Star className={`w-5 h-5 ${star <= burger.rating ? 'fill-brass text-brass' : 'text-line'}`} />
                                </button>
                              ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {burger.tags?.map((tag, tagIdx) => (
                                <span key={tagIdx} className={`${chip} inline-flex items-center gap-1`}>
                                  {tag}
                                  <button onClick={() => updateBurger(index, 'tags', burger.tags.filter((_, i) => i !== tagIdx))} aria-label={`Remove ${tag}`}>
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                              <select
                                onChange={(e) => {
                                  if (e.target.value && !burger.tags?.includes(e.target.value)) {
                                    updateBurger(index, 'tags', [...(burger.tags || []), e.target.value]);
                                    e.target.value = '';
                                  }
                                }}
                                className="text-[11px] bg-transparent border border-dashed border-line rounded-sm px-1.5 py-0.5 text-ink-muted"
                              >
                                <option value="">+ Label</option>
                                {cat.tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                              </select>
                            </div>
                          </div>

                          <textarea
                            value={burger.comments}
                            onChange={(e) => updateBurger(index, 'comments', e.target.value)}
                            placeholder={cat.commentPlaceholder}
                            aria-label="Tasting notes"
                            className="w-full px-3 py-2 bg-white/70 border border-line rounded-sm text-sm italic text-ink-soft placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine"
                            rows="2"
                          />
                        </div>

                        <button onClick={() => removeBurger(index)} aria-label={`Remove ${burger.name}`} className="text-ink-muted hover:text-wine p-2">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {rankedItems.length > 0 && (
              <div className="text-center mt-6">
                <button
                  onClick={saveRanking}
                  className="bg-wine text-paper px-10 py-4 rounded-sm uppercase tracking-[0.18em] text-sm font-semibold hover:bg-wine-dark transition-colors"
                >
                  {submitted[submittedKey] ? `Update My ${cat.label} Ranking` : `Submit My ${cat.label} Ranking`}
                </button>
                <p className="text-sm italic text-ink-muted mt-2">Your ranking will be visible to your followers.</p>
              </div>
            )}
            </div>
          </div>
        )}

        {view === 'wantToTry' && (
          <div className="grid gap-6 lg:gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
            <div className="space-y-6">
              {searchPanel}

              {/* Recommended */}
              <div className={panel}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <h3 className={heading}>{picks.title}</h3>
                  <button onClick={() => setShowRecommended(!showRecommended)} className="shrink-0 text-xs uppercase tracking-wider text-wine hover:text-wine-dark">
                    {showRecommended ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showRecommended && (
                  <div>
                    <p className="text-sm italic text-ink-muted mb-4">Haven't been yet? Tap the bookmark to save one for later.</p>
                    <div className="divide-y divide-line border-y border-line max-h-96 lg:max-h-[34rem] overflow-y-auto">
                      {picks.spots.map((place) => {
                        const saved = hasPlace(wantList, place);
                        const ranked = hasPlace(rankedItems, place);
                        return (
                          <div key={place.place_id} className="flex items-center justify-between py-3 px-2">
                            <div>
                              <div className="font-display text-lg text-ink leading-tight">{place.name}</div>
                              <div className="text-xs text-ink-muted">{place.address}</div>
                            </div>
                            {ranked || saved ? (
                              <span className="ml-2 shrink-0 text-[11px] uppercase tracking-wider text-ink-muted flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                {ranked ? 'Ranked' : 'Saved'}
                              </span>
                            ) : (
                              <button
                                onClick={() => addToWantToTry(place)}
                                aria-label={`Save ${place.name} to want to try`}
                                className="w-8 h-8 shrink-0 flex items-center justify-center border border-wine text-wine rounded-full hover:bg-wine hover:text-paper transition-colors ml-2"
                              >
                                <BookmarkPlus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className={panel}>
                <div className={eyebrow}>
                  {wantList.length} saved{sharedCount > 0 && ` · ${sharedCount} in common with people you follow`}
                </div>
                <h2 className="font-display text-3xl text-ink mt-1 mb-5">{cat.label} to Try</h2>

                {wantList.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-line rounded-sm text-ink-muted">
                    <Bookmark className="w-8 h-8 mx-auto mb-3 text-line" />
                    <div className="font-display italic text-2xl text-ink-soft mb-2">Nothing saved yet</div>
                    <p className="text-sm">Search for {cat.plural} you've been meaning to try, and see who you follow wants to go too.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-line border-y border-line">
                    {wantConnections.map(({ item, alsoWant, rankedBy }) => (
                      <div key={placeKey(item)} className="py-4 px-2 flex items-start gap-3">
                        <Bookmark className="w-4 h-4 mt-1.5 text-wine fill-wine shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-display text-xl text-ink">{item.name}</div>
                          <div className="text-sm text-ink-muted flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {item.address}
                          </div>
                          {alsoWant.length > 0 && (
                            <div className="mt-2 text-sm bg-wine-light border border-wine/20 rounded-sm px-3 py-1.5 text-wine flex items-start gap-1.5">
                              <Users className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>{listNames(alsoWant)} {alsoWant.length === 1 ? 'wants' : 'want'} to try this too. Go together?</span>
                            </div>
                          )}
                          {rankedBy.length > 0 && (
                            <div className="mt-2 text-sm bg-brass-light border border-brass/40 rounded-sm px-3 py-1.5 text-ink-soft flex items-start gap-1.5">
                              <Star className="w-3.5 h-3.5 mt-0.5 shrink-0 fill-brass text-brass" />
                              <span>
                                {rankedBy.map((r, i) => (
                                  <span key={r.username}>{i > 0 && ', '}@{r.username} ranked it #{r.rank}</span>
                                ))}
                              </span>
                            </div>
                          )}
                          <button
                            onClick={() => markTried(item)}
                            className="mt-3 text-xs uppercase tracking-wider font-semibold text-wine hover:text-wine-dark flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Tried it? Rank it
                          </button>
                        </div>
                        <button onClick={() => removeFromWantToTry(item)} aria-label={`Remove ${item.name}`} className="text-ink-muted hover:text-wine p-2">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={panel}>
                <div className={eyebrow}>From people you follow</div>
                <h3 className={`${heading} mt-1 mb-4`}>On Their Lists</h3>
                {followingUsers.length === 0 ? (
                  <p className="text-sm italic text-ink-muted">
                    Follow people to see the {cat.plural} they want to try.{' '}
                    <button onClick={() => openView('following')} className="text-wine hover:text-wine-dark underline underline-offset-2">Find people</button>
                  </p>
                ) : followsWant.length === 0 ? (
                  <p className="text-sm italic text-ink-muted">Nobody you follow has saved a {cat.singular} spot you haven't already.</p>
                ) : (
                  <div className="divide-y divide-line border-y border-line">
                    {followsWant.map(({ item, usernames }) => (
                      <div key={placeKey(item)} className="py-3 px-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-display text-lg text-ink leading-tight">{item.name}</div>
                          <div className="text-xs text-ink-muted">{item.address}</div>
                          <div className="text-xs text-wine mt-1">{listNames(usernames)} {usernames.length === 1 ? 'wants' : 'want'} to try it</div>
                        </div>
                        <button
                          onClick={() => addToWantToTry(item)}
                          className={`${quietButton} shrink-0 px-3 py-2 flex items-center gap-1`}
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          Me too
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'map' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'ranked', label: 'My ranking', dot: 'bg-wine' },
                { key: 'want', label: 'Want to try', dot: 'bg-brass' },
                { key: 'follows', label: 'People I follow', dot: 'bg-vert' },
              ].map(({ key, label, dot }) => (
                <button
                  key={key}
                  onClick={() => setMapLayers(prev => ({ ...prev, [key]: !prev[key] }))}
                  aria-pressed={mapLayers[key]}
                  className={`px-3 py-1.5 rounded-sm text-sm border flex items-center gap-2 transition-colors ${
                    mapLayers[key] ? 'border-ink-soft text-ink bg-card' : 'border-line text-ink-muted'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${dot} ${mapLayers[key] ? '' : 'opacity-30'}`} />
                  {label} ({layerCounts[key]})
                </button>
              ))}
            </div>

            <PlacesMap key={city} center={cityInfo.center} pins={mapPins} />

            {mapPins.length === 0 && (
              <p className="text-sm italic text-ink-muted text-center">
                No {cat.singular} spots to show yet. Add some to your ranking or want-to-try list, or follow people to see theirs.
              </p>
            )}
            {unmappedCount > 0 && (
              <p className="text-sm italic text-ink-muted text-center">
                {unmappedCount} of your {cat.singular} spots {unmappedCount === 1 ? "isn't" : "aren't"} on the map because {unmappedCount === 1 ? 'it was' : 'they were'} typed in by hand.
                {PLACES_URL && ' Use "Match it to the official listing" on My Ranking to place them.'}
              </p>
            )}
          </div>
        )}

        {view === 'leaderboard' && (
          <div className="grid gap-6 lg:gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] items-start">
            <div className={panel}>
              <div className={`${eyebrow} mb-3`}>Filter by label</div>
              <div className="flex flex-wrap gap-2">
                {cat.tags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSelectedTags(prev =>
                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                      );
                    }}
                    className={`px-3 py-1 rounded-sm text-sm border transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-wine border-wine text-paper'
                        : 'border-line text-ink-soft hover:border-ink-soft'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {selectedTags.length > 0 && (
                  <button onClick={() => setSelectedTags([])} className="px-3 py-1 text-sm italic text-wine hover:text-wine-dark">
                    Clear all
                  </button>
                )}
              </div>
            </div>

            <div className={panel}>
              <div className={eyebrow}>The leaderboard</div>
              <h2 className="font-display text-3xl text-ink mt-1 mb-5">{cityInfo.label}'s Best {cat.label}</h2>

              {filteredLeaderboard.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-line rounded-sm text-ink-muted">
                  <p className="font-display italic text-xl">{selectedTags.length > 0 ? `No ${cat.plural} match your filters` : 'No submissions yet. Be the first to rank!'}</p>
                </div>
              ) : (
                <div className="divide-y divide-line border-y border-line">
                  {filteredLeaderboard.map((burger, index) => (
                    <div key={index} className="flex items-center gap-4 py-4 px-2 hover:bg-paper/60">
                      <div className={`w-12 flex-shrink-0 text-center font-display italic leading-none ${
                        index < 3 ? 'text-5xl text-brass' : 'text-3xl text-ink-muted'
                      }`}>
                        {index + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-display text-xl text-ink">{burger.name}</div>
                        <div className="text-sm text-ink-muted flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {burger.address}
                        </div>
                        {burger.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {burger.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} className={chip}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 justify-end">
                          <Star className="w-4 h-4 fill-brass text-brass" />
                          <span className="font-display text-xl text-ink">{burger.avgRating}</span>
                        </div>
                        <div className="text-xs uppercase tracking-wider text-ink-muted">
                          {burger.submissions} {burger.submissions === 1 ? 'vote' : 'votes'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'following' && (
          <div className="grid gap-6 lg:gap-8 lg:grid-cols-2 items-start">
            {/* Search Users */}
            <div className={panel}>
              <h3 className={`${heading} mb-4`}>Discover Users</h3>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3.5 text-ink-muted w-4 h-4" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search for users..."
                  className={`${input} pl-9`}
                />
              </div>

              <div className="divide-y divide-line border-y border-line max-h-96 overflow-y-auto">
                {filteredUsers.slice(0, 10).map((user) => (
                  <div key={user.userId} className="flex items-center justify-between py-3 px-2 hover:bg-paper/60">
                    <div className="flex-1 cursor-pointer" onClick={() => viewUserProfile(user.userId)}>
                      <div className="font-semibold text-ink">@{user.username}</div>
                      <div className="text-xs text-ink-muted">{user.rankingCount} spots ranked</div>
                    </div>
                    {following.includes(user.userId) ? (
                      <button onClick={() => unfollowUser(user.userId)} className={`${quietButton} px-4 py-2`}>
                        Following
                      </button>
                    ) : (
                      <button onClick={() => followUser(user.userId)} className={`${primaryButton} px-4 py-2 flex items-center gap-1`}>
                        <UserPlus className="w-3.5 h-3.5" />
                        Follow
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:gap-8">
            {/* Following List */}
            <div id="people-you-follow" className={`${panel} scroll-mt-4`}>
              <h3 className={`${heading} mb-4`}>People You Follow ({following.length})</h3>
              {followingUsers.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-line rounded-sm text-ink-muted">
                  <Users className="w-8 h-8 mx-auto mb-3 text-line" />
                  <p className="font-display italic text-lg text-ink-soft">You're not following anyone yet</p>
                  <p className="text-sm mt-1">Search for users to start following.</p>
                </div>
              ) : (
                <div className="divide-y divide-line border-y border-line">
                  {followingUsers.map((user) => (
                    <div key={user.userId} className="flex items-center justify-between py-3 px-2 hover:bg-paper/60">
                      <div className="flex-1 cursor-pointer" onClick={() => viewUserProfile(user.userId)}>
                        <div className="font-semibold text-ink">@{user.username}</div>
                        <div className="text-xs text-ink-muted">
                          {user.rankingCount} spots ranked
                          {sharedWantCount(wantToTry, user.wantToTry) > 0 && (
                            <span className="text-wine"> · {sharedWantCount(wantToTry, user.wantToTry)} you both want to try</span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => viewUserProfile(user.userId)} className={`${quietButton} px-4 py-2`}>
                        View Profile
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Followers List */}
            <div id="your-followers" className={`${panel} scroll-mt-4`}>
              <h3 className={`${heading} mb-4`}>Your Followers ({followers.length})</h3>
              {followerUsers.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-line rounded-sm text-ink-muted">
                  <Users className="w-8 h-8 mx-auto mb-3 text-line" />
                  <p className="font-display italic text-lg text-ink-soft">No followers yet</p>
                  <p className="text-sm mt-1">When someone follows you, they'll show up here.</p>
                </div>
              ) : (
                <div className="divide-y divide-line border-y border-line">
                  {followerUsers.map((user) => (
                    <div key={user.userId} className="flex items-center justify-between gap-2 py-3 px-2 hover:bg-paper/60">
                      <div className="flex-1 cursor-pointer" onClick={() => viewUserProfile(user.userId)}>
                        <div className="font-semibold text-ink">@{user.username}</div>
                        <div className="text-xs text-ink-muted">{user.rankingCount} spots ranked</div>
                      </div>
                      {following.includes(user.userId) ? (
                        <button onClick={() => viewUserProfile(user.userId)} className={`${quietButton} px-4 py-2`}>
                          View Profile
                        </button>
                      ) : (
                        <button onClick={() => followUser(user.userId)} className={`${primaryButton} px-4 py-2 flex items-center gap-1`}>
                          <UserPlus className="w-3.5 h-3.5" />
                          Follow back
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>
        )}

        {view === 'profile' && selectedUserProfile && (
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => openView('following')}
              className="mb-4 text-sm italic text-wine hover:text-wine-dark"
            >
              ← Back to Following
            </button>

            <div className={panel}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-display text-3xl text-ink">@{selectedUserProfile.username}</h2>
                  <p className="text-sm text-ink-muted">{countAllRanked(selectedUserProfile.lists)} spots ranked</p>
                </div>
                {following.includes(selectedUserProfile.userId) ? (
                  <button onClick={() => unfollowUser(selectedUserProfile.userId)} className={`${quietButton} px-6 py-3`}>
                    Following
                  </button>
                ) : (
                  <button onClick={() => followUser(selectedUserProfile.userId)} className={`${primaryButton} px-6 py-3 flex items-center gap-2`}>
                    <UserPlus className="w-4 h-4" />
                    Follow
                  </button>
                )}
              </div>

              <div className={eyebrow}>Their picks · {cityInfo.name}</div>
              <h3 className={`${heading} mt-1 mb-4`}>Their Top {cat.label}</h3>
              {selectedUserProfile.lists[city].rankings[category].length === 0 ? (
                <p className="font-display italic text-ink-muted text-center py-8">This user hasn't ranked any {cat.plural} yet</p>
              ) : (
                <div className="divide-y divide-line border-y border-line">
                  {selectedUserProfile.lists[city].rankings[category].map((burger, index) => (
                    <div key={index} className="flex items-start gap-4 py-4 px-2">
                      <div className="w-10 flex-shrink-0 text-center font-display italic text-4xl leading-none text-wine">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-display text-xl text-ink">{burger.name}</div>
                        <div className="text-sm text-ink-muted flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {burger.address}
                        </div>
                        <div className="flex gap-0.5 mt-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={`w-4 h-4 ${star <= burger.rating ? 'fill-brass text-brass' : 'text-line'}`} />
                          ))}
                        </div>
                        {burger.comments && (
                          <div className="mt-2 font-display italic text-ink-soft pl-3 border-l-2 border-brass">
                            "{burger.comments}"
                          </div>
                        )}
                        {burger.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {burger.tags.map((tag, i) => (
                              <span key={i} className={chip}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(() => {
                const theirWants = selectedUserProfile.lists[city].wantToTry[category];
                return (
                  <div className="mt-8">
                    <div className={eyebrow}>Their want to try</div>
                    <h3 className={`${heading} mt-1 mb-4`}>{cat.label} They Want to Try</h3>
                    {theirWants.length === 0 ? (
                      <p className="font-display italic text-ink-muted text-center py-6">Nothing saved yet</p>
                    ) : (
                      <div className="divide-y divide-line border-y border-line">
                        {theirWants.map((item) => {
                          const both = hasPlace(wantList, item);
                          const ranked = rankedItems.findIndex(r => placeKey(r) === placeKey(item));
                          return (
                            <div key={placeKey(item)} className="py-3 px-2 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-display text-lg text-ink leading-tight">{item.name}</div>
                                <div className="text-xs text-ink-muted">{item.address}</div>
                                {both && <div className="text-xs text-wine mt-1">You both want to try this</div>}
                                {ranked >= 0 && <div className="text-xs text-brass mt-1">You ranked it #{ranked + 1}. Tell them about it!</div>}
                              </div>
                              {!both && ranked < 0 && (
                                <button onClick={() => addToWantToTry(item)} className={`${quietButton} shrink-0 px-3 py-2 flex items-center gap-1`}>
                                  <BookmarkPlus className="w-3.5 h-3.5" />
                                  Me too
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        <footer className="mt-12 text-center pb-10">
          <div className="flex items-center justify-center gap-3 mb-3" aria-hidden="true">
            <span className="h-px w-10 bg-line" />
            <span className="text-brass text-[10px]">◆</span>
            <span className="h-px w-10 bg-line" />
          </div>
          <p className="font-display italic text-ink-muted">Share your {cat.singular} rankings with friends</p>
        </footer>
      </div>
    </div>
  );
}
