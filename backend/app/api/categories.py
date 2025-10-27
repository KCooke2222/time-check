"""
Categories API blueprint.
Handles section and category management.
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import Section, Category
import json
import logging

logger = logging.getLogger(__name__)

categories_bp = Blueprint('categories', __name__)


# ==================== SECTIONS ====================

@categories_bp.route('/sections', methods=['GET'])
@login_required
def list_sections():
    """Get all sections for current user in hierarchical structure"""
    all_sections = current_user.sections.order_by(Section.display_order).all()

    def section_to_dict(section):
        return {
            'id': section.id,
            'name': section.name,
            'parent_id': section.parent_id,
            'display_order': section.display_order,
            'category_count': section.categories.count(),
            'children': [section_to_dict(child) for child in section.children.order_by(Section.display_order).all()]
        }

    # Get root sections (no parent)
    root_sections = [s for s in all_sections if s.parent_id is None]

    return jsonify({
        'sections': [section_to_dict(section) for section in sorted(root_sections, key=lambda s: s.display_order)]
    })


@categories_bp.route('/sections', methods=['POST'])
@login_required
def create_section():
    """Create a new section (can be nested under a parent section)"""
    data = request.get_json()

    if not data or 'name' not in data:
        return jsonify({'error': 'Section name is required'}), 400

    # Check for duplicate
    existing = Section.query.filter_by(
        user_id=current_user.id,
        name=data['name']
    ).first()

    if existing:
        return jsonify({'error': 'Section with this name already exists'}), 400

    # Validate parent_id if provided
    parent_id = data.get('parent_id')
    if parent_id:
        parent = Section.query.filter_by(id=parent_id, user_id=current_user.id).first()
        if not parent:
            return jsonify({'error': 'Parent section not found'}), 404

    section = Section(
        user_id=current_user.id,
        name=data['name'],
        parent_id=parent_id,
        display_order=data.get('display_order', 0)
    )

    db.session.add(section)
    db.session.commit()

    return jsonify({
        'message': 'Section created successfully',
        'section': {
            'id': section.id,
            'name': section.name,
            'parent_id': section.parent_id,
            'display_order': section.display_order
        }
    }), 201


@categories_bp.route('/sections/<int:section_id>', methods=['PUT'])
@login_required
def update_section(section_id):
    """Update a section (name, order, or parent)"""
    section = Section.query.filter_by(
        id=section_id,
        user_id=current_user.id
    ).first()

    if not section:
        return jsonify({'error': 'Section not found'}), 404

    data = request.get_json()

    if 'name' in data:
        section.name = data['name']
    if 'display_order' in data:
        section.display_order = data['display_order']
    if 'parent_id' in data:
        new_parent_id = data['parent_id']
        # Validate parent exists and prevent circular references
        if new_parent_id:
            parent = Section.query.filter_by(id=new_parent_id, user_id=current_user.id).first()
            if not parent:
                return jsonify({'error': 'Parent section not found'}), 404
            # Check for circular reference
            if new_parent_id == section_id:
                return jsonify({'error': 'Section cannot be its own parent'}), 400
            # Check if new parent is a descendant of this section
            current_parent = parent
            while current_parent:
                if current_parent.id == section_id:
                    return jsonify({'error': 'Cannot create circular reference'}), 400
                current_parent = current_parent.parent
        section.parent_id = new_parent_id

    db.session.commit()

    return jsonify({
        'message': 'Section updated successfully',
        'section': {
            'id': section.id,
            'name': section.name,
            'parent_id': section.parent_id,
            'display_order': section.display_order
        }
    })


@categories_bp.route('/sections/<int:section_id>', methods=['DELETE'])
@login_required
def delete_section(section_id):
    """Delete a section (and all its categories)"""
    section = Section.query.filter_by(
        id=section_id,
        user_id=current_user.id
    ).first()

    if not section:
        return jsonify({'error': 'Section not found'}), 404

    db.session.delete(section)
    db.session.commit()

    return jsonify({'message': 'Section deleted successfully'})


# ==================== CATEGORIES ====================

@categories_bp.route('/categories', methods=['GET'])
@login_required
def list_categories():
    """
    Get all categories for current user.
    Optional query param: section_id to filter by section
    """
    section_id = request.args.get('section_id', type=int)

    query = current_user.categories.outerjoin(Section)

    if section_id:
        query = query.filter(Category.section_id == section_id)

    categories = query.order_by(Category.display_order).all()

    return jsonify({
        'categories': [{
            'id': cat.id,
            'name': cat.name,
            'keywords': cat.get_keywords(),
            'section_id': cat.section_id,
            'section_name': cat.section.name if cat.section else None,
            'display_order': cat.display_order
        } for cat in categories]
    })


@categories_bp.route('/categories', methods=['POST'])
@login_required
def create_category():
    """Create a new category (can be root-level or in a section)"""
    data = request.get_json()

    if not data or 'name' not in data or 'keywords' not in data:
        return jsonify({'error': 'name and keywords are required'}), 400

    # Verify section exists and belongs to user (if provided)
    section_id = data.get('section_id')
    if section_id:
        section = Section.query.filter_by(
            id=section_id,
            user_id=current_user.id
        ).first()

        if not section:
            return jsonify({'error': 'Section not found'}), 404

    # Validate keywords is a list
    if not isinstance(data['keywords'], list):
        return jsonify({'error': 'keywords must be a list'}), 400

    category = Category(
        user_id=current_user.id,
        section_id=section_id,
        name=data['name'],
        display_order=data.get('display_order', 0)
    )
    category.set_keywords(data['keywords'])

    db.session.add(category)
    db.session.commit()

    return jsonify({
        'message': 'Category created successfully',
        'category': {
            'id': category.id,
            'name': category.name,
            'keywords': category.get_keywords(),
            'section_id': category.section_id,
            'display_order': category.display_order
        }
    }), 201


@categories_bp.route('/categories/<int:category_id>', methods=['PUT'])
@login_required
def update_category(category_id):
    """Update a category"""
    category = Category.query.filter_by(
        id=category_id,
        user_id=current_user.id
    ).first()

    if not category:
        return jsonify({'error': 'Category not found'}), 404

    data = request.get_json()

    if 'name' in data:
        category.name = data['name']
    if 'keywords' in data:
        if not isinstance(data['keywords'], list):
            return jsonify({'error': 'keywords must be a list'}), 400
        category.set_keywords(data['keywords'])
    if 'section_id' in data:
        # Verify section exists and belongs to user
        section = Section.query.filter_by(
            id=data['section_id'],
            user_id=current_user.id
        ).first()
        if not section:
            return jsonify({'error': 'Section not found'}), 404
        category.section_id = data['section_id']
    if 'display_order' in data:
        category.display_order = data['display_order']

    db.session.commit()

    return jsonify({
        'message': 'Category updated successfully',
        'category': {
            'id': category.id,
            'name': category.name,
            'keywords': category.get_keywords(),
            'section_id': category.section_id,
            'display_order': category.display_order
        }
    })


@categories_bp.route('/categories/<int:category_id>', methods=['DELETE'])
@login_required
def delete_category(category_id):
    """Delete a category"""
    category = Category.query.filter_by(
        id=category_id,
        user_id=current_user.id
    ).first()

    if not category:
        return jsonify({'error': 'Category not found'}), 404

    db.session.delete(category)
    db.session.commit()

    return jsonify({'message': 'Category deleted successfully'})
