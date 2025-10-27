"""
Category matcher service - implements substring matching logic
similar to the original Google Apps Script implementation.
"""

def find_category(event_title, categories):
    """
    Find the first matching category for an event title using substring matching.

    Args:
        event_title: str - the event title to match
        categories: list of Category model instances (should be ordered by priority)

    Returns:
        Category instance if match found, None otherwise
    """
    if not event_title or not categories:
        return None

    # Convert title to lowercase for case-insensitive matching
    title_lower = event_title.lower()

    # Iterate through categories in order (priority)
    for category in categories:
        keywords = category.get_keywords()

        # Check if any keyword appears as substring in title
        for keyword in keywords:
            if keyword.lower() in title_lower:
                return category

    # No match found
    return None


def categorize_events(events, categories):
    """
    Categorize a list of events using substring matching.

    Args:
        events: list of Event model instances
        categories: list of Category model instances (ordered by priority)

    Returns:
        dict: {event_id: category_id or None}
    """
    categorization = {}

    for event in events:
        matched_category = find_category(event.title, categories)
        categorization[event.id] = matched_category.id if matched_category else None

    return categorization


def get_category_priority_order(categories):
    """
    Sort categories by section display_order, then category display_order.
    This ensures matching happens in the correct priority.

    Args:
        categories: list of Category model instances with loaded section relationships

    Returns:
        list: sorted categories
    """
    return sorted(
        categories,
        key=lambda c: (c.section.display_order if c.section else 999999, c.display_order)
    )
