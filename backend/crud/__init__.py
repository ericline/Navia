"""CRUD package — re-exports all public functions for backward compatibility.

All existing `import crud; crud.get_trip(...)` calls continue to work unchanged.
"""
from crud.users import (
    get_user_by_email,
    create_user,
    update_user,
    user_preferences_from_db,
    user_to_out,
)
from crud.trips import (
    get_trip,
    get_trips_for_user,
    get_trips_detailed_for_user,
    create_trip,
    trip_to_response,
)
from crud.days import (
    get_day,
    get_days_for_trip,
    create_day,
    update_day,
    generate_days_for_trip,
)
from crud.activities import (
    get_activity,
    get_activities_for_trip,
    get_activities_for_day,
    get_bucket_activities,
    create_activity,
    update_activity,
    delete_activity,
)
from crud.collaborators import (
    get_collaborators,
    is_collaborator,
    add_collaborator,
    remove_collaborator,
)

__all__ = [
    "get_user_by_email", "create_user", "update_user",
    "user_preferences_from_db", "user_to_out",
    "get_trip", "get_trips_for_user", "get_trips_detailed_for_user",
    "create_trip", "trip_to_response",
    "get_day", "get_days_for_trip", "create_day", "update_day", "generate_days_for_trip",
    "get_activity", "get_activities_for_trip", "get_activities_for_day",
    "get_bucket_activities", "create_activity", "update_activity", "delete_activity",
    "get_collaborators", "is_collaborator", "add_collaborator", "remove_collaborator",
]
