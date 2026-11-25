#!/usr/bin/env python3
"""Builds the customer emails (emails/*.html) and the Supabase password reset email from one set of parts.

Design (Nathan, 25 Nov 2026): light canvas, Liquid Glass and soft 3D baked into images (email clients can't blur),
real app screens in phone frames, event artwork behind a glass panel, one short motion GIF, the gradient-framed pill
button, and the waving emblem sign-off. Bad news (cancelled, changed, refund) stays calm: no photo, no highlight.

Run: python3 scripts/email-design/gen.py && npm run email:build
Artwork: node scripts/email-design/render-assets.mjs
"""
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
INK, CANVAS, MUTED, LINE, CORAL, AMBER = '#1A1030', '#FCFAF8', '#655E6B', '#E6DFDC', '#FF5A5F', '#FF8A3D'
SANS = "'Inter',Arial,Helvetica,sans-serif"
DISP = "'Poppins',Arial,Helvetica,sans-serif"
PASS_LINE = 'Your digital ticket, in the Doorstep app and Apple Wallet.'
T = 'role="presentation" cellpadding="0" cellspacing="0" border="0"'


def asset(name, supa=False):
    return f'https://doorsteptickets.com/email-assets/{name}' if supa else '{{asset_base/' + name + '}}'


CSS = """body{margin:0;padding:0;background:#FCFAF8;-webkit-text-size-adjust:100%} a{color:#1A1030} img{border:0;outline:none}
.dsb-in{background-image:linear-gradient(115deg,#FF5A5F 0%,#FF8A3D 50%,#FFFFFF 50%,#FFFFFF 100%)!important;background-size:250% 100%!important;background-position:100% 0!important;transition:background-position .5s ease,color .3s ease}.dsb-ar{display:inline-block;transition:transform .3s ease,color .3s ease}.dsb:hover .dsb-in{background-position:0 0!important;color:#FFFFFF!important}.dsb:hover .dsb-ar{color:#FFFFFF!important;transform:translateX(4px)}.dsb:hover .dsb-ic{display:none!important}.dsb:hover .dsb-ic2{display:inline-block!important}@media (prefers-reduced-motion:reduce){.dsb-in,.dsb-ar{transition:none}}
@media (max-width:620px){.pad{padding-left:22px!important;padding-right:22px!important} h1{font-size:30px!important} .h1s{font-size:26px!important}
 .btn{display:block!important;padding:0 0 12px!important} .stack{display:block!important;width:100%!important;padding:0 0 12px!important} .bento{margin:0!important}
 .hero{padding-top:150px!important} .hide-s{display:none!important}}"""


def head(pre, title='Doorstep'):
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head><body style="margin:0;padding:0;background:{CANVAS}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{pre}&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;</div>
<table {T} width="100%" style="background:{CANVAS}"><tr><td align="center" style="padding:24px 12px">
<table {T} width="600" style="width:100%;max-width:600px">'''


def header(tag, supa=False):
    logo = asset('doorstep-lockup-c-light.png', True) if supa else '{{logo_url}}'
    site = 'https://doorsteptickets.com' if supa else '{{site_url}}'
    # A glass tag: frosted white with a hairline and a lit top edge (rgba falls back to white where unsupported).
    return f'''<tr><td style="padding:0 6px 18px"><table {T} width="100%"><tr>
<td><a href="{site}"><img src="{logo}" width="124" alt="doorstep" style="display:block;width:124px;height:auto;border:0"></a></td>
<td align="right"><span style="display:inline-block;font-family:{SANS};font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:{MUTED};border:1px solid #EDE7E4;border-top-color:#FFFFFF;border-radius:999px;padding:7px 13px;background-color:#FFFFFF;background-color:rgba(255,255,255,.72);box-shadow:0 6px 16px rgba(26,16,48,.07)">{tag}</span></td></tr></table></td></tr>'''


def card(inner):
    return f'''<tr><td style="background:#FFFFFF;border:1px solid {LINE};border-radius:24px;overflow:hidden;box-shadow:0 18px 44px rgba(26,16,48,.08)">
<table {T} width="100%">{inner}</table></td></tr>'''


def hl(text):
    """The gradient underline, under the whole highlighted phrase."""
    return (f'<span style="color:{INK};background-image:linear-gradient(90deg,{CORAL},{AMBER});background-repeat:no-repeat;'
            f'background-size:100% 7px;background-position:0 94%;padding-bottom:2px">{text}</span>')


def h1(text, size=36, mb=12):
    return f'<h1 style="margin:0 0 {mb}px;font-family:{DISP};font-size:{size}px;line-height:1.15;font-weight:600;letter-spacing:-.015em;color:{INK}">{text}</h1>'


def p(text, size=16, color=MUTED, mb=12, weight=400):
    return f'<p style="margin:0 0 {mb}px;font-family:{SANS};font-size:{size}px;line-height:1.55;font-weight:{weight};color:{color}">{text}</p>'


def row(inner, pad='28px 32px 0'):
    return f'<tr><td class="pad" style="padding:{pad}">{inner}</td></tr>'


def image(src, alt, href=None, w=600, radius=0):
    img = f'<img src="{src}" width="{w}" alt="{alt}" style="display:block;width:100%;max-width:{w}px;height:auto;border-radius:{radius}px">'
    return f'<a href="{href}" style="text-decoration:none">{img}</a>' if href else img


def glass_hero(kicker, title, meta):
    """Event artwork behind a frosted ink glass panel. Outlook on Windows shows the ink fallback with the same text."""
    return f'''<tr><td class="hero" background="{{{{event_image_url}}}}" bgcolor="{INK}" valign="bottom" style="background-color:{INK};background-image:url('{{{{event_image_url}}}}');background-size:cover;background-position:center;padding:210px 18px 18px">
<table {T} width="100%" style="background-color:{INK};background-color:rgba(26,16,48,.66);border:1px solid rgba(255,255,255,.22);border-radius:20px"><tr><td style="padding:18px 22px 20px">
<p style="margin:0 0 8px;font-family:{SANS};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:{AMBER}">{kicker}</p>
<p class="h1s" style="margin:0 0 6px;font-family:{DISP};font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-.01em;color:#FFFFFF">{title}</p>
<p style="margin:0;font-family:{SANS};font-size:15px;line-height:1.45;color:#E4DFEC">{meta}</p></td></tr></table></td></tr>'''


def calm_hero(kicker, title, sub):
    """Bad news: ink panel with a lit top edge, no photo and no highlight."""
    return f'''<tr><td bgcolor="{INK}" style="background-color:{INK};background-image:linear-gradient(180deg,#2A1F42 0%,{INK} 55%,#140B26 100%);padding:34px 32px 32px" class="pad">
<p style="margin:0 0 10px;font-family:{SANS};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#B9B1C6">{kicker}</p>
<h1 style="margin:0 0 10px;font-family:{DISP};font-size:32px;line-height:1.15;font-weight:600;letter-spacing:-.01em;color:#FFFFFF">{title}</h1>
<p style="margin:0;font-family:{SANS};font-size:16px;line-height:1.55;color:#D9D3E3">{sub}</p></td></tr>'''


def button(label, href, supa=False):
    ic, ic2 = asset('btn-ic-grad.png', supa), asset('btn-ic-white.png', supa)
    return f'''<td class="btn" style="padding:0 12px 12px 0"><table {T} class="dsb"><tr><td style="border-radius:999px;padding:2px;background-color:#FF6F4D;background-image:linear-gradient(135deg,{CORAL},{AMBER})"><a href="{href}" class="dsb-in" style="display:inline-block;border-radius:999px;background-color:#FFFFFF;padding:11px 22px 11px 15px;font-family:{DISP};font-size:16px;font-weight:600;line-height:22px;color:{INK};text-decoration:none;white-space:nowrap"><img class="dsb-ic" src="{ic}" width="22" height="22" alt="" style="display:inline-block;width:22px;height:22px;border:0;vertical-align:-5px;margin-right:9px"><img class="dsb-ic2" src="{ic2}" width="22" height="22" alt="" style="display:none;width:22px;height:22px;border:0;vertical-align:-5px;margin-right:9px">{label}<span class="dsb-ar" style="color:{CORAL};margin-left:12px">&rarr;</span></a></td></tr></table></td>'''


def button2(label, href):
    return f'''<td class="btn" style="padding:0 12px 12px 0"><table {T}><tr><td style="border-radius:999px;background:#FFFFFF;border:1px solid #8B818F"><a href="{href}" style="display:inline-block;padding:14px 24px;font-family:{DISP};font-size:16px;font-weight:600;line-height:20px;color:{INK};text-decoration:none;border-radius:999px;white-space:nowrap">{label}</a></td></tr></table></td>'''


def buttons(*cells, mt=6):
    return f'<table {T} style="margin:{mt}px 0 8px"><tr>{"".join(cells)}</tr></table>'


def stub():
    """The ink door pass stub: lit gradient, notches and a dashed tear line. Never a barcode."""
    return f'''<table {T} width="100%" bgcolor="{INK}" style="margin:6px 0 20px;background-color:{INK};background-image:linear-gradient(180deg,#2A1F42 0%,{INK} 58%,#140B26 100%);border-radius:22px;box-shadow:0 22px 40px -22px rgba(26,16,48,.55)">
<tr><td colspan="3" style="padding:22px 24px 18px"><table {T} width="100%"><tr><td valign="top">
<p style="margin:0 0 10px;font-family:{SANS};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:{AMBER}">{{{{event_date_short}}}} · Doors {{{{doors_time}}}}</p>
<p style="margin:0 0 4px;font-family:{DISP};font-size:23px;line-height:1.2;font-weight:700;color:#FFFFFF">{{{{event_name}}}}</p>
<p style="margin:0;font-family:{SANS};font-size:15px;line-height:1.45;color:#D9D3E3">{{{{venue_name}}}}, {{{{venue_area}}}}</p></td>
<td valign="top" align="right" width="84"><p style="margin:0;font-family:{SANS};font-size:11px;font-weight:700;letter-spacing:.14em;color:#B9B1C6">ADMIT</p><p style="margin:0;font-family:{DISP};font-size:48px;line-height:1;font-weight:700;color:{CORAL}">{{{{qty}}}}</p></td></tr></table></td></tr>
<tr><td width="12" style="font-size:0;line-height:0"><img src="{asset('notch-l.png')}" width="12" height="24" alt="" style="display:block;width:12px;height:24px"></td><td style="border-top:2px dashed #4A3F66;font-size:0;line-height:0">&nbsp;</td><td width="12" style="font-size:0;line-height:0"><img src="{asset('notch-r.png')}" width="12" height="24" alt="" style="display:block;width:12px;height:24px"></td></tr>
<tr><td colspan="3" style="padding:12px 24px 18px;font-family:{SANS};font-size:13px;line-height:1.4;color:#B9B1C6">Door pass · Order {{{{order_ref}}}} · {{{{qty}}}} × {{{{ticket_type}}}}</td></tr></table>'''


def tile(label, body, w='50%', side=''):
    """Soft 3D tile: lit white gradient, hairline and a soft shadow."""
    pad = {'l': '0 6px 0 0', 'r': '0 0 0 6px'}.get(side, '0')
    return f'''<td class="stack" valign="top" width="{w}" style="padding:{pad}"><table {T} width="100%" style="background-color:#FFFFFF;background-image:linear-gradient(180deg,#FFFFFF,#FAF7F5);border:1px solid #EFE9E6;border-radius:18px;box-shadow:0 14px 28px -20px rgba(26,16,48,.35)"><tr><td style="padding:16px 18px 18px">
<p style="margin:0 0 6px;font-family:{SANS};font-size:11px;line-height:1.4;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:{MUTED}">{label}</p>
<p style="margin:0;font-family:{SANS};font-size:15px;line-height:1.5;color:{INK}">{body}</p></td></tr></table></td>'''


def bento(*rows_):
    out = ''
    for cells in rows_:
        if len(cells) == 2:  # a 12px gutter between paired tiles; phones stack them
            cells = [cells[0].replace('style="padding:0"', 'style="padding:0 6px 0 0"', 1), cells[1].replace('style="padding:0"', 'style="padding:0 0 0 6px"', 1)]
        out += f'<table {T} class="bento" width="100%" style="margin:0 0 12px"><tr>{"".join(cells)}</tr></table>'
    return out


def steps(items):
    out = f'<table {T} width="100%" style="margin:4px 0 18px">'
    for i, (title, body, done) in enumerate(items):
        dot = (f'<td width="30" valign="top" style="padding-top:2px"><div style="width:22px;height:22px;border-radius:50%;background:{INK};color:#FFFFFF;font:700 12px/22px Arial,sans-serif;text-align:center">&#10003;</div></td>'
               if done else f'<td width="30" valign="top" style="padding-top:2px"><div style="width:18px;height:18px;border-radius:50%;border:2px solid {CORAL};background:#FFFFFF"></div></td>')
        out += f'''<tr>{dot}<td style="padding:0 0 14px 6px"><p style="margin:0;font-family:{DISP};font-size:15px;font-weight:600;line-height:1.4;color:{INK}">{title}</p><p style="margin:2px 0 0;font-family:{SANS};font-size:14px;line-height:1.5;color:{MUTED}">{body}</p></td></tr>'''
    return out + '</table>'


def rows(items, mb=20):
    out = f'<table {T} width="100%" style="margin:0 0 {mb}px">'
    for i, (k, v) in enumerate(items):
        bt = f'border-top:1px solid {LINE};' if i else ''
        out += f'''<tr><td valign="top" width="140" style="{bt}padding:12px 0;font-family:{SANS};font-size:12px;line-height:1.6;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:{INK}">{k}</td><td style="{bt}padding:12px 0;font-family:{SANS};font-size:15px;line-height:1.55;color:{INK}">{v}</td></tr>'''
    return out + '</table>'


def signoff(line, supa=False):
    return f'''<img src="{asset('squiggle.png', supa)}" width="150" alt="" style="display:block;width:150px;height:auto;margin:22px 0 16px;border:0">
<table {T}><tr><td valign="middle" width="60"><img src="{asset('emblem-wave-white.gif', supa)}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border:0"></td><td valign="middle" style="font-family:{SANS};font-size:15px;line-height:1.45;color:{INK}">{line},<br><span style="font-family:{DISP};font-weight:700">The Doorstep crew</span></td></tr></table>'''


def footer(reason, supa=False):
    company = ('Doorstep · doorsteptickets.com' if supa
               else '{{company_legal_name}} · {{company_address}} · Company no. {{company_number}}')
    tag = (f'Good nights out, <span style="background-image:linear-gradient(90deg,{CORAL},{AMBER});background-repeat:no-repeat;'
           f'background-position:0 94%;padding-bottom:2px;background-size:100% 4px">on your Doorstep.</span>')
    return f'''<tr><td style="padding:28px 6px 6px;font-family:{DISP};font-size:18px;font-weight:600;color:{INK}">{tag}</td></tr>
<tr><td style="padding:0 6px 24px;font-family:{SANS};font-size:13px;line-height:1.55;color:{MUTED}">
<p style="margin:0 0 8px">Stuck on something? Just reply, or write to <a href="mailto:support@doorsteptickets.com" style="color:{INK}">support@doorsteptickets.com</a>. Our support team, helped by AI, will get back to you, and a real person is always on hand.</p>
<p style="margin:0 0 8px">{reason}</p>
<p style="margin:0">{company}</p></td></tr></table></td></tr></table></body></html>
'''


def email(pre, tag, body, reason, supa=False, title='Doorstep'):
    return head(pre, title) + '\n' + header(tag, supa) + '\n' + card(body) + '\n' + footer(reason, supa)


E = {}

# 1. Welcome -------------------------------------------------------------------------------------------------
E['welcome'] = email(
    'Gigs, comedy, theatre and more, at venues near you.', 'Welcome',
    row(h1('Good nights out,<br>' + hl('on your Doorstep.'), 38, 14)
        + p('Hello {{first_name}}. Gigs, comedy, theatre and more, at venues near you, and the brilliant nights you’d otherwise hear about the day after.', 17, MUTED, 0), '34px 32px 22px')
    + f'<tr><td style="padding:0">{image(asset("hero-welcome.jpg"), "The Doorstep app on a phone: fees included, no membership", "{{events_url}}")}</td></tr>'
    + row(bento(
        [tile('1 · Free account', 'No membership, no subscription. You only pay for the tickets you book.'),
         tile('2 · Fees included', 'The price you see is the price you pay. No surprises at checkout.')],
        [tile('3 · Door passes the moment you book', PASS_LINE + ' Show it at the door.', '100%')])
        + buttons(button('See what’s on near you', '{{events_url}}'), mt=8)
        + signoff('See you out there') + '<div style="height:30px"></div>', '24px 32px 0'),
    'You’re getting this because you created a Doorstep account.')

# 2. Order confirmed ----------------------------------------------------------------------------------------
E['order-confirmed'] = email(
    'Booked. Your door passes are ready now, in the app and Apple Wallet.', 'Order {{order_ref}}',
    glass_hero('You’re going', '{{event_name}}', '{{event_date_short}} · Doors {{doors_time}} · {{venue_name}}, {{venue_area}}')
    + row(h1('Booked. Your door passes are ' + hl('ready now.'), 32, 10)
          + p(f'Good choice, {{{{first_name}}}}. {PASS_LINE} Show it at the door and you’re in.', 16, MUTED, 18)
          + image(asset('pass-ready.gif'), 'Your door pass is ready in the Doorstep app', '{{tickets_url}}', 536, 18)
          + buttons(button('View my door passes', '{{tickets_url}}'), button2('Add to Apple Wallet', '{{wallet_url}}'), mt=18)
          + stub()
          + f'''<table {T} width="100%" style="margin:0 0 18px;font-family:{SANS};font-size:15px;line-height:1.5;color:{INK}">
<tr><td style="padding:10px 0;color:{MUTED}">{{{{qty}}}} × {{{{ticket_type}}}} at {{{{unit_price}}}}</td><td align="right" style="padding:10px 0">{{{{line_total}}}}</td></tr>
<tr><td style="padding:10px 0;border-top:1px solid {LINE};color:{MUTED}">Booking fees</td><td align="right" style="padding:10px 0;border-top:1px solid {LINE}">{{{{fee_total}}}}</td></tr>
<tr><td style="padding:12px 0;border-top:2px solid {INK};font-family:{DISP};font-weight:700">Total paid</td><td align="right" style="padding:12px 0;border-top:2px solid {INK};font-family:{DISP};font-size:18px;font-weight:700">{{{{order_total}}}}</td></tr>
<tr><td colspan="2" style="padding:2px 0 0;font-size:13px;color:{MUTED}">Paid with {{{{payment_method}}}}</td></tr></table>'''
          + f'<p style="margin:6px 0 10px;font-family:{DISP};font-size:20px;font-weight:600;color:{INK}">What happens next</p>'
          + steps([('Booked', 'Today. You’re all set.', True),
                   ('Door passes ready', 'Now, in the app and Apple Wallet.', True),
                   ('Doors open', '{{doors_time}}, {{event_date}}. We’ll send a reminder the day before.', False)])
          + p(f'<a href="{{{{calendar_url}}}}" style="color:{INK};font-weight:600">Add it to your calendar</a> · Plans changed? Here’s our <a href="{{{{refund_policy_url}}}}" style="color:{INK}">refund policy</a>.', 14, MUTED, 0)
          + signoff('See you out there') + '<div style="height:30px"></div>', '30px 32px 0'),
    'You’re getting this because you booked tickets on Doorstep.')

# 3. Day-before reminder ------------------------------------------------------------------------------------
E['event-reminder'] = email(
    'Doors open at {{doors_time}} on {{event_day}}. Your door passes are ready in the app.', 'See you soon',
    glass_hero('Tomorrow · Doors {{doors_time}}', 'See you {{event_day}}', '{{event_name}} · {{venue_name}}, {{venue_area}}')
    + row(h1('Your night out is ' + hl('nearly here.'), 32, 10)
          + p(f'Your door passes are ready to go. {PASS_LINE}', 16, MUTED, 18)
          + buttons(button('View my door passes', '{{tickets_url}}'), button2('Add to Apple Wallet', '{{wallet_url}}'), mt=4)
          + f'<p style="margin:14px 0 12px;font-family:{DISP};font-size:20px;font-weight:600;color:{INK}">Plan your night</p>'
          + bento(
              [tile('Doors', '{{doors_time}}, {{event_date}}'),
               tile('Getting there', f'{{{{venue_name}}}}, {{{{venue_address}}}}<br><a href="{{{{maps_url}}}}" style="color:{INK};font-weight:600">Open in Maps</a>')],
              [tile('At the door', 'Screen brightness up, door pass open. Each pass scans once.'),
               tile('Your door passes', '{{qty}} × {{ticket_type}}<br>Order {{order_ref}}')])
          + signoff('Have a brilliant night') + '<div style="height:30px"></div>', '30px 32px 0'),
    'You’re getting this because you booked tickets on Doorstep.')

# 4. Event cancelled ----------------------------------------------------------------------------------------
E['event-cancelled'] = email(
    'We’ve refunded {{refund_amount}} in full. You don’t need to do anything.', 'Refund',
    calm_hero('{{event_name}} · {{event_date_short}}', 'You’ve been refunded in full',
              'This event has been cancelled. We’re really sorry, {{first_name}}.')
    + row(p('{{venue_name}} has had to cancel {{event_name}} on {{event_date}}. Your door passes no longer open the door, and you don’t need to do anything to get your money back.', 16, INK, 18)
          + rows([('Order', '{{order_ref}}'), ('Refunded to', '{{payment_method}}'), ('Amount', '<strong>{{refund_amount}}</strong>')], 14)
          + p('That’s everything you paid, booking fees included. It usually shows on your statement within 5 to 10 working days.', 14, MUTED, 18)
          + buttons(button('Find another night out', '{{events_url}}'), mt=4)
          + signoff('Sorry again') + '<div style="height:30px"></div>', '28px 32px 0'),
    'You’re getting this because you booked tickets for this event on Doorstep.')

# 5. Event changed (new date, time or venue) ----------------------------------------------------------------
E['event-changed'] = email(
    '{{event_name}} has a new {{change_label}}. Your door passes still work.', 'Update',
    calm_hero('{{event_name}}', 'There’s a new {{change_label}}', 'Your door passes still work. If you can’t make it now, you can have a full refund.')
    + row(p('{{change_reason}}', 16, INK, 16)
          + rows([('Was', f'<span style="color:{MUTED};text-decoration:line-through">{{{{old_details}}}}</span>'),
                  ('Now', '<strong>{{new_details}}</strong>'),
                  ('Your order', '{{order_ref}} · {{qty}} × {{ticket_type}}')], 16)
          + f'<p style="margin:2px 0 12px;font-family:{DISP};font-size:20px;font-weight:600;color:{INK}">What you can do</p>'
          + bento([tile('Still going?', 'Nothing to do. Your door passes work for the new {{change_label}}.'),
                   tile('Can’t make it?', 'Ask for a full refund, booking fees included, by {{refund_deadline}}.')])
          + buttons(button('Keep my door passes', '{{tickets_url}}'), button2('Ask for a refund', '{{refund_request_url}}'), mt=8)
          + signoff('Sorry for the change') + '<div style="height:30px"></div>', '28px 32px 0'),
    'You’re getting this because you booked tickets for this event on Doorstep.')

# 6. Refund issued (one order, not a whole-event cancellation) ----------------------------------------------
E['refund-issued'] = email(
    'We’ve refunded {{refund_amount}} for order {{order_ref}}.', 'Refund',
    calm_hero('Order {{order_ref}}', 'You’ve been refunded {{refund_amount}}', '{{event_name}} · {{event_date_short}}')
    + row(p('Hi {{first_name}}, your refund is on its way. {{refund_note}}', 16, INK, 16)
          + rows([('Event', '{{event_name}}, {{venue_name}}'), ('Refunded to', '{{payment_method}}'), ('Amount', '<strong>{{refund_amount}}</strong>')], 14)
          + p('It usually shows on your statement within 5 to 10 working days. Door passes covered by this refund no longer open the door.', 14, MUTED, 18)
          + buttons(button('View my door passes', '{{tickets_url}}'), mt=4)
          + signoff('Thanks') + '<div style="height:30px"></div>', '28px 32px 0'),
    'You’re getting this because you booked tickets on Doorstep.')

# 7. Password reset: sent by Supabase Auth, so it uses Supabase's own variables and absolute asset links.
RESET = email(
    'Choose a new password for your Doorstep account. The link works once.', 'Account',
    row(h1('Reset your ' + hl('password.'), 34, 10)
        + p('Someone asked to reset the password for {{ .Email }}. If that was you, choose a new one below.', 16, MUTED, 0), '34px 32px 18px')
    + f'<tr><td style="padding:0">{image(asset("hero-reset.jpg", True), "")}</td></tr>'
    + row(buttons(button('Choose a new password', '{{ .ConfirmationURL }}', True), mt=0)
          + p('The link works once and expires in an hour. If you didn’t ask for this, you can ignore this email and your password won’t change.', 14, MUTED, 0)
          + signoff('Thanks', True) + '<div style="height:30px"></div>', '24px 32px 0'),
    'You’re getting this because a password reset was asked for on your Doorstep account.', supa=True, title='Reset your password')

if __name__ == '__main__':
    for k, v in E.items():
        open(os.path.join(ROOT, 'emails', k + '.html'), 'w').write(v)
    os.makedirs(os.path.join(ROOT, 'supabase', 'templates'), exist_ok=True)
    open(os.path.join(ROOT, 'supabase', 'templates', 'recovery.html'), 'w').write(RESET)
    print('wrote', len(E), 'emails + supabase/templates/recovery.html')
