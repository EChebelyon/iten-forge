#!/usr/bin/env python3
"""
Called by GitHub Actions cron every evening.
Sends tomorrow's workout via Twilio WhatsApp.
"""

import os
from datetime import date, timedelta

from twilio.rest import Client

from iten_forge.config import GOAL_TIME, START_DATE, UNIT
from iten_forge.plan import Plan

SIGNOFFS = {
    1: "Week 1 -- building the base.",
    2: "Settling into the rhythm. Stay consistent.",
    3: "Building momentum. Trust the process.",
    4: "End of Build phase -- you're ready for what's next.",
    5: "Peak phase begins. Time to sharpen the sword.",
    6: "Deep in the work. This is where races are won.",
    7: "Peak week. Embrace the discomfort.",
    8: "THE biggest week. You've got this.",
    9: "Last peak week. Soak it up.",
    10: "Taper begins. The hay is in the barn.",
    11: "Trust the fitness. Stay sharp, stay fresh.",
    12: "Race week. You're ready.",
}


def main():
    plan = Plan(goal_time=GOAL_TIME, start_date=START_DATE, unit=UNIT)
    tomorrow = date.today() + timedelta(days=1)

    if tomorrow < plan.start_date or tomorrow >= plan.race_day:
        print(f"Outside training window ({plan.start_date} to {plan.race_day}). Skipping.")
        return

    workout = plan.workout(tomorrow)
    if workout is None:
        print("No workout found for tomorrow. Skipping.")
        return

    message_body = plan.format_message(workout)
    message_body += f"\n\n{SIGNOFFS.get(workout['week'], 'Keep going.')}"

    client = Client(
        os.environ["TWILIO_ACCOUNT_SID"],
        os.environ["TWILIO_AUTH_TOKEN"],
    )
    message = client.messages.create(
        body=message_body,
        from_=os.environ["TWILIO_WHATSAPP_FROM"],
        to=os.environ["MY_WHATSAPP_NUMBER"],
    )
    print(f"Sent reminder for {tomorrow} (Week {workout['week']}): SID {message.sid}")


if __name__ == "__main__":
    main()
