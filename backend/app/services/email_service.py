"""
Email service for sending weekly reports with Gemini-generated insights.
"""

from flask import current_app, render_template_string
from flask_mail import Message
from app import mail
from app.services.report_generator import generate_weekly_report
from datetime import datetime, timedelta
import google.generativeai as genai
import logging

logger = logging.getLogger(__name__)


def send_weekly_report_email(user, week_date=None):
    """
    Send weekly report email to user with Gemini-generated insights.

    Args:
        user: User model instance
        week_date: datetime - week to report on (defaults to previous week)

    Returns:
        bool: True if email sent successfully
    """
    # Use previous week if not specified
    if not week_date:
        week_date = datetime.utcnow() - timedelta(days=7)

    # Generate report
    try:
        report = generate_weekly_report(user, week_date)
    except Exception as e:
        logger.error(f"Failed to generate report for user {user.id}: {e}")
        return False

    # Generate Gemini insights
    insights = generate_gemini_insights(report)

    # Create email
    try:
        msg = Message(
            subject=f"Weekly Time Tracking Report - {datetime.now().strftime('%Y-%m-%d')}",
            recipients=[user.email],
            sender=current_app.config['MAIL_DEFAULT_SENDER']
        )

        # Create HTML email body
        msg.html = render_email_template(report, insights, user)

        # Send email
        mail.send(msg)
        logger.info(f"Weekly report email sent to {user.email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {user.email}: {e}")
        return False


def generate_gemini_insights(report):
    """
    Generate insights and tips using Gemini AI based on the report data.

    Args:
        report: dict - weekly report data

    Returns:
        str: AI-generated insights
    """
    api_key = current_app.config.get('GEMINI_API_KEY')

    if not api_key:
        logger.warning("GEMINI_API_KEY not configured, skipping AI insights")
        return "Configure GEMINI_API_KEY in your .env file to receive AI-powered insights."

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-pro')

        # Prepare summary for Gemini
        total_raw = report['totals']['raw_hours']
        total_intensity = report['totals']['intensity_hours']
        intensity_bonus = total_intensity - total_raw

        # Get top categories
        top_categories = sorted(
            report['category_summary'].items(),
            key=lambda x: x[1]['intensity_hours'],
            reverse=True
        )[:3]

        prompt = f"""Based on this weekly time tracking data, provide 2-3 brief, actionable insights or motivational tips (max 150 words total):

Weekly Summary:
- Total hours tracked: {total_raw:.1f}h
- Intensity-adjusted hours: {total_intensity:.1f}h
- Intensity bonus: {intensity_bonus:.1f}h

Top Categories:
{chr(10).join([f"- {data['name']}: {data['intensity_hours']:.1f}h (intensity-adjusted)" for _, data in top_categories])}

Focus on productivity patterns, work-life balance, or suggestions for improvement. Keep it friendly and encouraging."""

        response = model.generate_content(prompt)
        return response.text

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return "Unable to generate AI insights at this time."


def render_email_template(report, insights, user):
    """
    Render HTML email template.

    Args:
        report: dict - weekly report data
        insights: str - AI-generated insights
        user: User model instance

    Returns:
        str: HTML email content
    """
    # Prepare top categories
    top_categories = sorted(
        report['category_summary'].items(),
        key=lambda x: x[1]['intensity_hours'],
        reverse=True
    )[:5]

    # Prepare top sections
    top_sections = sorted(
        report['section_summary'].items(),
        key=lambda x: x[1]['intensity_hours'],
        reverse=True
    )

    template = """
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                border-radius: 10px;
                margin-bottom: 20px;
            }
            .summary-box {
                background: #f7fafc;
                border-left: 4px solid #4299e1;
                padding: 15px;
                margin: 20px 0;
                border-radius: 5px;
            }
            .stat-grid {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 15px;
                margin: 20px 0;
            }
            .stat-card {
                background: white;
                border: 1px solid #e2e8f0;
                padding: 15px;
                border-radius: 8px;
                text-align: center;
            }
            .stat-value {
                font-size: 24px;
                font-weight: bold;
                color: #2d3748;
            }
            .stat-label {
                font-size: 12px;
                color: #718096;
                text-transform: uppercase;
                margin-top: 5px;
            }
            .insights {
                background: #fef5e7;
                border-left: 4px solid #f39c12;
                padding: 15px;
                margin: 20px 0;
                border-radius: 5px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            th, td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #e2e8f0;
            }
            th {
                background: #edf2f7;
                font-weight: 600;
                color: #2d3748;
            }
            .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
                text-align: center;
                color: #718096;
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1 style="margin: 0;">Weekly Time Tracking Report</h1>
            <p style="margin: 10px 0 0 0;">{{ week_start }} - {{ week_end }}</p>
        </div>

        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-value">{{ total_raw }}h</div>
                <div class="stat-label">Raw Hours</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #4299e1;">{{ total_intensity }}h</div>
                <div class="stat-label">Intensity Hours</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #48bb78;">+{{ intensity_bonus }}h</div>
                <div class="stat-label">Intensity Bonus</div>
            </div>
        </div>

        <div class="insights">
            <h3 style="margin-top: 0; color: #d68910;">AI Insights</h3>
            <p style="margin: 0;">{{ insights }}</p>
        </div>

        <h3>Time by Section</h3>
        <table>
            <thead>
                <tr>
                    <th>Section</th>
                    <th>Raw Hours</th>
                    <th>Intensity Hours</th>
                </tr>
            </thead>
            <tbody>
                {% for section in sections %}
                <tr>
                    <td><strong>{{ section.name }}</strong></td>
                    <td>{{ section.raw_hours }}h</td>
                    <td style="color: #4299e1;"><strong>{{ section.intensity_hours }}h</strong></td>
                </tr>
                {% endfor %}
            </tbody>
        </table>

        <h3>Top Categories</h3>
        <table>
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Section</th>
                    <th>Raw Hours</th>
                    <th>Intensity Hours</th>
                </tr>
            </thead>
            <tbody>
                {% for category in categories %}
                <tr>
                    <td>{{ category.name }}</td>
                    <td style="color: #718096; font-size: 12px;">{{ category.section }}</td>
                    <td>{{ category.raw_hours }}h</td>
                    <td style="color: #4299e1;"><strong>{{ category.intensity_hours }}h</strong></td>
                </tr>
                {% endfor %}
            </tbody>
        </table>

        <div class="footer">
            <p>Generated with Time Track - Intensity-Based Time Tracking</p>
            <p>Powered by Google Gemini AI</p>
        </div>
    </body>
    </html>
    """

    # Prepare template variables
    from jinja2 import Template
    jinja_template = Template(template)

    return jinja_template.render(
        week_start=datetime.fromisoformat(report['week_start']).strftime('%B %d, %Y'),
        week_end=datetime.fromisoformat(report['week_end']).strftime('%B %d, %Y'),
        total_raw=f"{report['totals']['raw_hours']:.1f}",
        total_intensity=f"{report['totals']['intensity_hours']:.1f}",
        intensity_bonus=f"{report['totals']['intensity_hours'] - report['totals']['raw_hours']:.1f}",
        insights=insights,
        sections=[
            {
                'name': data['name'],
                'raw_hours': f"{data['raw_hours']:.1f}",
                'intensity_hours': f"{data['intensity_hours']:.1f}"
            }
            for _, data in top_sections
        ],
        categories=[
            {
                'name': data['name'],
                'section': data['section_name'],
                'raw_hours': f"{data['raw_hours']:.1f}",
                'intensity_hours': f"{data['intensity_hours']:.1f}"
            }
            for _, data in top_categories
        ]
    )
