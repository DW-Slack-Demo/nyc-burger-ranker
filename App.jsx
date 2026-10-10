import React, { useState, useEffect, useRef } from 'react';
import { Search, GripVertical, Star, Trophy, MapPin, MessageSquare, Trash2, Plus, Sparkles, Tag, Filter, X, User, UserPlus, Users, Settings, LogOut } from 'lucide-react';

import { getFirebase, loadFirestoreSdk, databaseErrorMessage } from './firebase.js';
import { watchAuth, logOut } from './auth.js';
import { loadUser, createProfile, saveRankings, submitRanking, loadAllUsers as fetchAllUsers, loadFollowers as fetchFollowers, setFollowing as saveFollowing } from './userStore.js';
import AuthScreen from './AuthScreen.jsx';

const CATEGORIES = {
  burgers: {
    label: 'Burgers',
    emoji: '🍔',
    singular: 'burger',
    plural: 'burgers',
    recommendedTitle: 'Recommended by Eater & Timeout',
    searchPlaceholder: 'Search for burger spots in NYC...',
    aiPlaceholder: "E.g., I'm in the West Village, find me a burger spot",
    commentPlaceholder: 'What makes this burger special?',
    recommended: [
      { name: "Raoul's", address: "180 Prince St, NY 10012", place_id: "raouls", source: "Eater", tags: ["Classic", "Upscale"] },
      { name: "J.G. Melon", address: "1291 3rd Ave, NY 10021", place_id: "jgmelon", source: "Timeout", tags: ["Classic", "No-frills"] },
      { name: "Corner Bistro", address: "331 W 4th St, NY 10014", place_id: "corner", source: "Eater", tags: ["Classic", "Dive Bar"] },
      { name: "Shake Shack", address: "Multiple Locations", place_id: "shakeshack", source: "Timeout", tags: ["Chain", "Fast Casual"] },
      { name: "Superiority Burger", address: "119 Avenue A, NY 10009", place_id: "superiority", source: "Eater", tags: ["Vegetarian"] },
      { name: "Emily", address: "Multiple Locations", place_id: "emily", source: "Eater", tags: ["Upscale"] },
      { name: "Minetta Tavern", address: "113 MacDougal St, NY 10012", place_id: "minetta", source: "Eater", tags: ["Upscale", "Classic"] },
      { name: "Burger Joint", address: "119 W 56th St, NY 10019", place_id: "burgerjoint", source: "Timeout", tags: ["Hidden Gem"] },
      { name: "Peter Luger", address: "178 Broadway, Brooklyn", place_id: "luger", source: "Eater", tags: ["Steakhouse"] },
      { name: "Black Tap", address: "Multiple Locations", place_id: "blacktap", source: "Timeout", tags: ["Instagrammable"] },
      { name: "Flip Sigi", address: "324 E 11th St, NY 10003", place_id: "flipsigi", source: "Eater", tags: ["Smash Burger"] },
    ],
    tags: ["Classic", "Upscale", "Vegetarian", "Smash Burger", "Fast Casual", "Gastropub", "Dive Bar", "Hidden Gem", "Steakhouse", "Chain", "No-frills", "Instagrammable"],
  },
  martinis: {
    label: 'Martinis',
    emoji: '🍸',
    singular: 'martini',
    plural: 'martinis',
    recommendedTitle: 'Popular Martini Spots',
    searchPlaceholder: 'Search for martini bars in NYC...',
    aiPlaceholder: "E.g., Somewhere classy near Grand Central for a dirty martini",
    commentPlaceholder: 'What makes this martini special?',
    recommended: [
      { name: "Bemelmans Bar", address: "35 E 76th St, NY 10021", place_id: "bemelmans", tags: ["Hotel Bar", "Classic"] },
      { name: "King Cole Bar", address: "2 E 55th St, NY 10022", place_id: "kingcole", tags: ["Hotel Bar", "Upscale"] },
      { name: "Dante", address: "79-81 MacDougal St, NY 10012", place_id: "dante", tags: ["Classic", "Happy Hour"] },
      { name: "The Campbell", address: "15 Vanderbilt Ave, NY 10017", place_id: "campbell", tags: ["Upscale", "Hidden Gem"] },
      { name: "Temple Bar", address: "332 Lafayette St, NY 10012", place_id: "templebar", tags: ["Classic", "Speakeasy"] },
      { name: "Keens Steakhouse", address: "72 W 36th St, NY 10018", place_id: "keens", tags: ["Steakhouse", "Classic"] },
      { name: "Employees Only", address: "510 Hudson St, NY 10014", place_id: "employeesonly", tags: ["Speakeasy"] },
      { name: "Gage & Tollner", address: "372 Fulton St, Brooklyn", place_id: "gagetollner", tags: ["Classic", "Upscale"] },
      { name: "Dear Irving", address: "55 Irving Pl, NY 10003", place_id: "dearirving", tags: ["Speakeasy", "Instagrammable"] },
    ],
    tags: ["Classic", "Dirty", "Gin", "Vodka", "Hotel Bar", "Speakeasy", "Steakhouse", "Upscale", "Dive Bar", "Hidden Gem", "Happy Hour", "Instagrammable"],
  },
  pizza: {
    label: 'Pizza',
    emoji: '🍕',
    singular: 'pizza',
    plural: 'pizzas',
    recommendedTitle: 'Popular Pizza Spots',
    searchPlaceholder: 'Search for pizza places in NYC...',
    aiPlaceholder: "E.g., Best late-night slice in the East Village",
    commentPlaceholder: 'What makes this pizza special?',
    recommended: [
      { name: "Lucali", address: "575 Henry St, Brooklyn", place_id: "lucali", tags: ["Whole Pie", "Cash Only"] },
      { name: "Di Fara", address: "1424 Avenue J, Brooklyn", place_id: "difara", tags: ["Classic", "Slice"] },
      { name: "Joe's Pizza", address: "7 Carmine St, NY 10014", place_id: "joes", tags: ["Slice", "New York Style"] },
      { name: "Prince Street Pizza", address: "27 Prince St, NY 10012", place_id: "princestreet", tags: ["Sicilian", "Slice"] },
      { name: "L'Industrie", address: "Multiple Locations", place_id: "lindustrie", tags: ["Slice"] },
      { name: "John's of Bleecker Street", address: "278 Bleecker St, NY 10014", place_id: "johns", tags: ["Coal Oven", "Whole Pie"] },
      { name: "Lombardi's", address: "32 Spring St, NY 10012", place_id: "lombardis", tags: ["Coal Oven", "Classic"] },
      { name: "Scarr's Pizza", address: "35 Orchard St, NY 10002", place_id: "scarrs", tags: ["Slice", "New York Style"] },
      { name: "Una Pizza Napoletana", address: "175 Orchard St, NY 10002", place_id: "unapizza", tags: ["Neapolitan", "Wood-Fired"] },
      { name: "Totonno's", address: "1524 Neptune Ave, Brooklyn", place_id: "totonnos", tags: ["Coal Oven", "Classic"] },
      { name: "Joe & Pat's", address: "1758 Victory Blvd, Staten Island", place_id: "joeandpats", tags: ["Whole Pie", "Classic"] },
    ],
    tags: ["Slice", "Whole Pie", "New York Style", "Neapolitan", "Sicilian", "Grandma", "Coal Oven", "Wood-Fired", "Classic", "Hidden Gem", "Cash Only", "Late Night"],
  },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);

// Users saved before categories existed only have a top-level `ranking` (burgers).
const normalizeRankings = (data) => {
  const rankings = { ...(data?.rankings || {}) };
  if (!rankings.burgers && data?.ranking) rankings.burgers = data.ranking;
  CATEGORY_KEYS.forEach((key) => { rankings[key] = rankings[key] || []; });
  return rankings;
};

const countRanked = (rankings) => CATEGORY_KEYS.reduce((sum, key) => sum + rankings[key].length, 0);

export default function NYCBurgerRanker() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [category, setCategory] = useState('burgers');
  const [rankings, setRankings] = useState(() => normalizeRankings(null));
  const [leaderboards, setLeaderboards] = useState(() => normalizeRankings(null));
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragSource, setDragSource] = useState(null);
  const [view, setView] = useState('ranking'); // 'ranking', 'leaderboard', 'following', 'profile'
  const [submitted, setSubmitted] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState({});
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiSearchResults, setAiSearchResults] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [showRecommended, setShowRecommended] = useState(true);
  const [selectedTags, setSelectedTags] = useState([]);
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  
  // User profile & social features
  const [username, setUsername] = useState('');
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
  const rankedItems = rankings[category];
  const setRankedItems = (items) => setRankings(prev => ({ ...prev, [category]: items }));
  const leaderboard = leaderboards[category];

  const switchCategory = (key) => {
    setCategory(key);
    setSearchResults([]);
    setSearchQuery('');
    setAiSearchResults('');
    setSelectedTags([]);
    setDraggedIndex(null);
    setDragSource(null);
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
    const serialized = JSON.stringify(rankings);
    if (serialized === lastSavedRankingsRef.current) return;

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveRankings(userId, JSON.parse(serialized));
        lastSavedRankingsRef.current = serialized;
        setSaveStatus('saved');
      } catch (error) {
        console.error('Error saving lists:', error);
        setSaveStatus('error');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [rankings, userId]);

  const resetUserState = () => {
    lastSavedRankingsRef.current = null;
    setUserId(null);
    setUsername('');
    setRankings(normalizeRankings(null));
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

      const loadedRankings = normalizeRankings(profile);
      lastSavedRankingsRef.current = JSON.stringify(loadedRankings);
      setRankings(loadedRankings);
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
      setAllUsers(users.map((data) => ({
        userId: data.userId,
        username: data.username,
        rankingCount: countRanked(normalizeRankings(data)),
        updatedAt: data.updatedAt,
      })));
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
      const serialized = JSON.stringify(rankings);
      if (lastSavedRankingsRef.current !== null && serialized !== lastSavedRankingsRef.current) {
        await saveRankings(userId, rankings);
      }
      await logOut();
    } catch (error) {
      console.error('Error logging out:', error);
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
          rankings: normalizeRankings(data),
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
      
      const scoresByCategory = {};
      CATEGORY_KEYS.forEach((key) => { scoresByCategory[key] = {}; });
      snapshot.forEach((doc) => {
        const submission = doc.data();
        // Submissions saved before categories existed are burger rankings.
        const burgerScores = scoresByCategory[submission.category || 'burgers'];
        if (!burgerScores) return;
        (submission.items || submission.burgers)?.forEach((burger, index) => {
          const placeId = burger.place_id || burger.name;
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
          burgerScores[placeId].totalRatings += burger.rating;
          burgerScores[placeId].submissions += 1;
          
          if (burger.comments?.trim()) {
            burgerScores[placeId].comments.push(burger.comments.trim());
          }
        });
      });

      const leaderboardData = {};
      CATEGORY_KEYS.forEach((key) => {
        leaderboardData[key] = Object.values(scoresByCategory[key])
          .map((burger) => ({
            ...burger,
            avgRating: (burger.totalRatings / burger.submissions).toFixed(1),
          }))
          .sort((a, b) => b.totalPoints - a.totalPoints)
          .slice(0, 20);
      });

      setLeaderboards(leaderboardData);
    } catch (error) {
      console.error('Error updating leaderboard:', error);
    }
  };

  const handleAiSearch = async () => {
    if (!aiSearchQuery.trim()) return;
    setIsAiSearching(true);
    setAiSearchResults('');
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are a NYC ${cat.singular} expert. Based on this request: "${aiSearchQuery}", recommend 2-3 specific ${cat.singular} spots in NYC with their neighborhoods. Be concise. Format: Restaurant Name (Neighborhood) - brief reason why.`
          }],
        }),
      });

      const data = await response.json();
      const textContent = data.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
      setAiSearchResults(textContent);
    } catch (error) {
      setAiSearchResults('Could not get recommendations. Try the search bar or browse recommended spots below.');
    }
    setIsAiSearching(false);
  };

  const searchBurgers = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    
    const allBurgers = [...cat.recommended];
    const lowerQuery = searchQuery.toLowerCase();
    const filtered = allBurgers.filter(b => 
      b.name.toLowerCase().includes(lowerQuery) || 
      b.address.toLowerCase().includes(lowerQuery)
    );
    
    setSearchResults(filtered.length > 0 ? filtered.slice(0, 5) : [
      { name: searchQuery, address: "New York, NY", place_id: `custom-${Date.now()}` }
    ]);
    setIsSearching(false);
  };

  const addBurger = (place) => {
    if (rankedItems.length >= 10) {
      alert(`You can only rank 10 ${cat.plural}!`);
      return;
    }
    if (rankedItems.some(b => b.place_id === place.place_id)) {
      alert(`This ${cat.singular} is already in your ranking!`);
      return;
    }

    setRankedItems([...rankedItems, {
      place_id: place.place_id,
      name: place.name,
      address: place.address,
      rating: 5,
      comments: '',
      tags: place.tags || [],
    }]);
    setSearchResults([]);
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

    const burger = cat.recommended[draggedIndex];
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
      await saveRankings(userId, rankings);
      lastSavedRankingsRef.current = JSON.stringify(rankings);
      await submitRanking(userId, username, category, rankedItems);

      setSubmitted(prev => ({ ...prev, [category]: true }));
      await updateLeaderboard(db);
      setTimeout(() => setView('leaderboard'), 1000);
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error saving ranking. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🍔</div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <p className="text-gray-700">{initError}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600"
            >
              Try again
            </button>
            <button
              onClick={async () => { await logOut().catch(() => {}); setInitError(''); }}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300"
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

  const followingUsers = allUsers.filter(u => following.includes(u.userId));

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6 pt-8">
          <h1 className="text-5xl font-bold text-gray-800 mb-2">🍔🍸🍕 Top Shelf</h1>
          <p className="text-gray-600">Rank your top 10 burgers, martinis and pizza in New York City</p>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm">
            <User className="w-4 h-4 text-orange-600" />
            <span className="font-medium text-gray-700">@{username}</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-600">{following.length} following</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-600">{followers.length} followers</span>
            <span className="text-gray-500">•</span>
            <button onClick={handleLogOut} className="text-gray-600 hover:text-orange-600 flex items-center gap-1">
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
          {saveStatus && (
            <div className={`mt-1 text-xs ${saveStatus === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
              {saveStatus === 'saving' && 'Saving your lists...'}
              {saveStatus === 'saved' && 'All changes saved'}
              {saveStatus === 'error' && 'Could not save your lists. Check your connection.'}
            </div>
          )}
        </div>

        {view !== 'following' && (
          <div className="flex justify-center gap-2 mb-4">
            {CATEGORY_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => switchCategory(key)}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  category === key ? 'bg-gray-800 text-white shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {CATEGORIES[key].emoji} {CATEGORIES[key].label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-6 bg-white rounded-lg p-1 shadow-sm overflow-x-auto">
          <button
            onClick={() => setView('ranking')}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-all whitespace-nowrap ${
              view === 'ranking' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            My Ranking
          </button>
          <button
            onClick={() => setView('leaderboard')}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-all whitespace-nowrap ${
              view === 'leaderboard' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Trophy className="inline w-5 h-5 mr-1" />
            Leaderboard
          </button>
          <button
            onClick={() => setView('following')}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-all whitespace-nowrap ${
              view === 'following' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Users className="inline w-5 h-5 mr-1" />
            Following ({following.length})
          </button>
        </div>

        {view === 'ranking' && (
          <>
            {/* Search */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchBurgers()}
                    placeholder={cat.searchPlaceholder}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={searchBurgers}
                  disabled={isSearching}
                  className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-300"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  {searchResults.map((place, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{place.name}</div>
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {place.address}
                        </div>
                      </div>
                      <button
                        onClick={() => addBurger(place)}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Search */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-sm p-6 mb-6 border-2 border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-bold text-gray-800">AI {cat.label} Finder</h3>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={aiSearchQuery}
                  onChange={(e) => setAiSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAiSearch()}
                  placeholder={cat.aiPlaceholder}
                  className="flex-1 px-4 py-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleAiSearch}
                  disabled={isAiSearching}
                  className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isAiSearching ? 'Thinking...' : 'Ask AI'}
                </button>
              </div>
              {aiSearchResults && (
                <div className="bg-white p-4 rounded-lg border border-purple-200">
                  <p className="text-sm text-gray-700 whitespace-pre-line">{aiSearchResults}</p>
                </div>
              )}
            </div>

            {/* Recommended */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">🏆 {cat.recommendedTitle}</h3>
                <button onClick={() => setShowRecommended(!showRecommended)} className="text-sm text-orange-600">
                  {showRecommended ? 'Hide' : 'Show'}
                </button>
              </div>
              {showRecommended && (
                <div>
                  <p className="text-sm text-gray-600 mb-4">Drag and drop these into your ranking!</p>
                  <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
                    {cat.recommended.map((burger, idx) => (
                      <div
                        key={idx}
                        draggable
                        onDragStart={() => handleDragStart(idx, 'recommended')}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg border-2 cursor-move ${
                          dragSource === 'recommended' && draggedIndex === idx
                            ? 'border-orange-500 bg-orange-50 shadow-lg'
                            : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        <div className="flex-1 flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="font-medium text-gray-800">{burger.name}</div>
                            <div className="text-xs text-gray-600">{burger.address}</div>
                            <div className="flex gap-1 mt-1">
                              {burger.source && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{burger.source}</span>
                              )}
                              {burger.tags.slice(0, 2).map((tag, i) => (
                                <span key={i} className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{tag}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => addBurger(burger)} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg ml-2">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ranked List - abbreviated for space */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Your Top {cat.label}</h2>
              <p className="text-sm text-gray-600 mb-4">{rankedItems.length} of 10 {cat.plural} ranked</p>
              
              {rankedItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">{cat.emoji}</div>
                  <p>Drag {cat.plural} from the recommended list or search to add them!</p>
                </div>
              ) : (
                <div 
                  className="space-y-3"
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
                      className={`border-2 rounded-lg p-4 cursor-move ${
                        draggedIndex === index && dragSource === 'ranked'
                          ? 'border-orange-500 bg-orange-50 shadow-lg'
                          : 'border-gray-200 bg-white hover:border-orange-300'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                            {index + 1}
                          </div>
                          <GripVertical className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="flex-1 space-y-3">
                          <div>
                            <input
                              type="text"
                              value={burger.name}
                              onChange={(e) => updateBurger(index, 'name', e.target.value)}
                              className="font-bold text-gray-800 text-lg w-full border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none bg-transparent px-1"
                            />
                            <div className="flex items-start gap-1 mt-1">
                              <MapPin className="w-3 h-3 mt-1 text-gray-400" />
                              <input
                                type="text"
                                value={burger.address}
                                onChange={(e) => updateBurger(index, 'address', e.target.value)}
                                className="text-sm text-gray-600 flex-1 border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none bg-transparent px-1"
                                placeholder="Add address..."
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Rating:</span>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button key={star} onClick={() => updateBurger(index, 'rating', star)}>
                                  <Star className={`w-6 h-6 ${star <= burger.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                              <MessageSquare className="w-4 h-4" />
                              Comments
                            </label>
                            <textarea
                              value={burger.comments}
                              onChange={(e) => updateBurger(index, 'comments', e.target.value)}
                              placeholder={cat.commentPlaceholder}
                              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                              rows="2"
                            />
                          </div>

                          <div>
                            <label className="text-sm text-gray-600 flex items-center gap-1 mb-2">
                              <Tag className="w-4 h-4" />
                              Labels
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {burger.tags?.map((tag, tagIdx) => (
                                <span key={tagIdx} className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded">
                                  {tag}
                                  <button onClick={() => updateBurger(index, 'tags', burger.tags.filter((_, i) => i !== tagIdx))}>
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
                                className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-600"
                              >
                                <option value="">+ Add label</option>
                                {cat.tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>

                        <button onClick={() => removeBurger(index)} className="text-red-500 hover:text-red-700 p-2">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {rankedItems.length > 0 && (
              <div className="text-center">
                <button
                  onClick={saveRanking}
                  className="bg-green-500 text-white px-8 py-4 rounded-lg text-lg font-bold hover:bg-green-600 shadow-lg"
                >
                  {submitted[category] ? `✓ Update My ${cat.label} Ranking` : `Submit My ${cat.label} Ranking`}
                </button>
                <p className="text-sm text-gray-600 mt-2">Your ranking will be visible to your followers!</p>
              </div>
            )}
          </>
        )}

        {view === 'leaderboard' && (
          <div>
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-800">Filter by labels:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {cat.tags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSelectedTags(prev => 
                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                      );
                    }}
                    className={`px-3 py-1 rounded-full text-sm ${
                      selectedTags.includes(tag)
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {selectedTags.length > 0 && (
                  <button onClick={() => setSelectedTags([])} className="px-3 py-1 rounded-full text-sm bg-red-100 text-red-700">
                    Clear all
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Trophy className="w-8 h-8 text-yellow-500" />
                NYC's Best {cat.label}
              </h2>

              {filteredLeaderboard.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">🏆</div>
                  <p>{selectedTags.length > 0 ? `No ${cat.plural} match your filters` : 'No submissions yet. Be the first to rank!'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLeaderboard.map((burger, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-4 p-4 hover:bg-gray-100">
                        <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                          {index === 0 && <span className="text-4xl">🥇</span>}
                          {index === 1 && <span className="text-4xl">🥈</span>}
                          {index === 2 && <span className="text-4xl">🥉</span>}
                          {index > 2 && (
                            <div className="w-10 h-10 bg-gray-300 text-gray-700 rounded-full flex items-center justify-center font-bold">
                              {index + 1}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-800 text-lg">{burger.name}</div>
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {burger.address}
                          </div>
                          {burger.tags?.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {burger.tags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-1 justify-end mb-1">
                            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                            <span className="font-bold text-lg">{burger.avgRating}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {burger.submissions} {burger.submissions === 1 ? 'vote' : 'votes'}
                          </div>
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
          <div>
            {/* Search Users */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Discover Users</h3>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search for users..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredUsers.slice(0, 10).map((user) => (
                  <div key={user.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                    <div className="flex-1 cursor-pointer" onClick={() => viewUserProfile(user.userId)}>
                      <div className="font-medium text-gray-800">@{user.username}</div>
                      <div className="text-xs text-gray-600">{user.rankingCount} spots ranked</div>
                    </div>
                    {following.includes(user.userId) ? (
                      <button
                        onClick={() => unfollowUser(user.userId)}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-300"
                      >
                        Following
                      </button>
                    ) : (
                      <button
                        onClick={() => followUser(user.userId)}
                        className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 flex items-center gap-1"
                      >
                        <UserPlus className="w-4 h-4" />
                        Follow
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Following List */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">People You Follow ({following.length})</h3>
              {followingUsers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>You're not following anyone yet</p>
                  <p className="text-sm mt-2">Search for users above to start following!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {followingUsers.map((user) => (
                    <div key={user.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                      <div className="flex-1 cursor-pointer" onClick={() => viewUserProfile(user.userId)}>
                        <div className="font-medium text-gray-800">@{user.username}</div>
                        <div className="text-xs text-gray-600">{user.rankingCount} spots ranked</div>
                      </div>
                      <button
                        onClick={() => viewUserProfile(user.userId)}
                        className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600"
                      >
                        View Profile
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'profile' && selectedUserProfile && (
          <div>
            <button
              onClick={() => setView('following')}
              className="mb-4 text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              ← Back to Following
            </button>
            
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">@{selectedUserProfile.username}</h2>
                  <p className="text-sm text-gray-600">{countRanked(selectedUserProfile.rankings)} spots ranked</p>
                </div>
                {following.includes(selectedUserProfile.userId) ? (
                  <button
                    onClick={() => unfollowUser(selectedUserProfile.userId)}
                    className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-300"
                  >
                    Following
                  </button>
                ) : (
                  <button
                    onClick={() => followUser(selectedUserProfile.userId)}
                    className="bg-orange-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-600 flex items-center gap-2"
                  >
                    <UserPlus className="w-5 h-5" />
                    Follow
                  </button>
                )}
              </div>

              <h3 className="text-lg font-bold text-gray-800 mb-4">Their Top {cat.label}</h3>
              {selectedUserProfile.rankings[category].length === 0 ? (
                <p className="text-gray-500 text-center py-8">This user hasn't ranked any {cat.plural} yet</p>
              ) : (
                <div className="space-y-3">
                  {selectedUserProfile.rankings[category].map((burger, index) => (
                    <div key={index} className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-800 text-lg">{burger.name}</div>
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {burger.address}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} className={`w-5 h-5 ${star <= burger.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                              ))}
                            </div>
                          </div>
                          {burger.comments && (
                            <div className="mt-2 text-sm text-gray-700 italic bg-white p-3 rounded border-l-2 border-orange-500">
                              "{burger.comments}"
                            </div>
                          )}
                          {burger.tags?.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {burger.tags.map((tag, i) => (
                                <span key={i} className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-500 pb-8">
          <p>{cat.emoji} Share your {cat.singular} rankings with friends!</p>
        </div>
      </div>
    </div>
  );
}
