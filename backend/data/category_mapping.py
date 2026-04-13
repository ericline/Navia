"""Maps Google Places types to Navia's 15 activity categories.

Google Places API (New) returns a `types` array with values like
"restaurant", "tourist_attraction", etc.  This module maps those to
Navia's category set used by the frontend and arrangement strategies.
"""

# Navia's canonical activity categories (must match frontend CATEGORY_* constants)
NAVIA_CATEGORIES = [
    "food", "cafe", "bar", "museum", "park", "beach", "shopping",
    "nightlife", "worship", "wellness", "transport", "hotel",
    "entertainment", "landmark", "other",
]

# Google type → Navia category.  First match wins (order matters for
# types that could map to multiple categories).
_TYPE_MAP: dict[str, str] = {
    # Food & drink
    "restaurant": "food",
    "meal_delivery": "food",
    "meal_takeaway": "food",
    "bakery": "food",
    "cafe": "cafe",
    "coffee_shop": "cafe",
    "bar": "bar",
    "night_club": "nightlife",
    # Culture
    "museum": "museum",
    "art_gallery": "museum",
    "library": "museum",
    # Nature
    "park": "park",
    "campground": "park",
    "natural_feature": "park",
    "garden": "park",
    # Beach
    "beach": "beach",
    # Shopping
    "shopping_mall": "shopping",
    "store": "shopping",
    "clothing_store": "shopping",
    "book_store": "shopping",
    "jewelry_store": "shopping",
    "market": "shopping",
    # Worship
    "church": "worship",
    "mosque": "worship",
    "synagogue": "worship",
    "hindu_temple": "worship",
    "place_of_worship": "worship",
    # Wellness
    "spa": "wellness",
    "gym": "wellness",
    "yoga": "wellness",
    "hair_care": "wellness",
    # Transport
    "train_station": "transport",
    "bus_station": "transport",
    "airport": "transport",
    "transit_station": "transport",
    "subway_station": "transport",
    # Hotel
    "lodging": "hotel",
    "hotel": "hotel",
    "hostel": "hotel",
    # Entertainment
    "amusement_park": "entertainment",
    "movie_theater": "entertainment",
    "stadium": "entertainment",
    "bowling_alley": "entertainment",
    "casino": "entertainment",
    "aquarium": "entertainment",
    "zoo": "entertainment",
    # Landmark
    "tourist_attraction": "landmark",
    "monument": "landmark",
    "city_hall": "landmark",
    "embassy": "landmark",
}

# Search terms used when querying Google Places for each Navia category.
# We search for these terms + " in {destination}" to fill the places DB.
CATEGORY_SEARCH_TERMS: dict[str, str] = {
    "food": "best restaurants",
    "cafe": "popular cafes coffee shops",
    "bar": "bars cocktail lounges",
    "museum": "museums art galleries",
    "park": "parks gardens nature",
    "beach": "beaches waterfront",
    "shopping": "shopping markets boutiques",
    "nightlife": "nightlife clubs live music",
    "worship": "temples churches mosques shrines",
    "wellness": "spa wellness yoga",
    "entertainment": "entertainment attractions amusement",
    "landmark": "famous landmarks monuments sightseeing",
    "other": "unique things to do hidden gems",
}

# Categories we skip during ingestion (transport/hotel are not recommendation-worthy)
SKIP_CATEGORIES = {"transport", "hotel"}

# Neighborhoods for deep-ingestion sub-queries. Keys are matched against
# normalized destination strings (lowercased, whitespace-collapsed).
NEIGHBORHOOD_HINTS: dict[str, list[str]] = {
    "new york, ny": ["Manhattan", "Brooklyn", "Midtown", "SoHo", "Williamsburg"],
    "boston, ma": ["Back Bay", "North End", "Cambridge", "Seaport", "Beacon Hill"],
    "seattle, wa": ["Capitol Hill", "Ballard", "Belltown", "Fremont", "Pioneer Square"],
    "san francisco, ca": ["Mission", "North Beach", "SoMa", "Hayes Valley", "Chinatown"],
    "chicago, il": ["Loop", "Wicker Park", "Lincoln Park", "River North", "Pilsen"],
}

# Cuisine/style sub-queries applied to the "food" category during deep ingestion.
CUISINE_HINTS: list[str] = [
    "Italian", "Japanese ramen", "brunch spots", "fine dining", "cheap eats",
]


def _normalize_destination(destination: str) -> str:
    return " ".join(destination.lower().split())


def get_neighborhoods(destination: str) -> list[str]:
    """Return neighborhood sub-query hints for a destination, or empty list."""
    return NEIGHBORHOOD_HINTS.get(_normalize_destination(destination), [])


def map_google_types_to_category(types: list[str]) -> str:
    """Map a list of Google Places types to a single Navia category.

    Returns the first matching category, or "other" if no match.
    """
    for t in types:
        if t in _TYPE_MAP:
            return _TYPE_MAP[t]
    return "other"
