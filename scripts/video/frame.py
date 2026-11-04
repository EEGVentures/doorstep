from PIL import Image, ImageDraw, ImageFont, ImageFilter
SS = 2
W, H = 1080, 1920
pt = 1.944                      # px per iPhone point (390pt -> 758px)
sw, sh = round(390*pt), round(844*pt)   # screen 758 x 1641
bez, rim = 22, 6                # black bezel, titanium rim
ow, oh = sw + 2*(bez+rim), sh + 2*(bez+rim)
ox, oy = (W-ow)//2, (H-oh)//2
sx, sy = ox+bez+rim, oy+bez+rim
sr = round(55*pt)               # screen corner radius
open('/tmp/claude-0/iphone/geom.txt','w').write(f"{sx} {sy} {sw} {sh} {round(54*pt)}\n")
S = lambda v: round(v*SS)

# Background: canvas with a soft shadow under the phone
bg = Image.new('RGB', (W, H), '#FCFAF8')
sh_ = Image.new('L', (W, H), 0); d = ImageDraw.Draw(sh_)
d.rounded_rectangle([ox+30, oy+60, ox+ow-30, oy+oh+30], radius=sr+40, fill=90)
sh_ = sh_.filter(ImageFilter.GaussianBlur(45))
bg.paste(Image.new('RGB', (W, H), '#3a2f45'), (0, 0), sh_.point(lambda v: int(v*0.55)))
bg.save('/tmp/claude-0/iphone/bg.png')

# Frame overlay at 2x, transparent screen hole
F = Image.new('RGBA', (W*SS, H*SS), (0,0,0,0)); d = ImageDraw.Draw(F)
R = sr + bez + rim
# side buttons (behind body)
for (x0, y0, x1, y1) in [(ox-4, oy+250, ox+4, oy+310), (ox-4, oy+370, ox+4, oy+490), (ox-4, oy+515, ox+4, oy+635), (ox+ow-4, oy+420, ox+ow+4, oy+600)]:
    d.rounded_rectangle([S(x0), S(y0), S(x1), S(y1)], radius=S(3), fill='#8d8a90')
d.rounded_rectangle([S(ox), S(oy), S(ox+ow), S(oy+oh)], radius=S(R), fill='#a7a3ab')          # titanium
d.rounded_rectangle([S(ox+1.5), S(oy+1.5), S(ox+ow-1.5), S(oy+oh-1.5)], radius=S(R-1.5), fill='#d9d6dc')  # highlight
d.rounded_rectangle([S(ox+3), S(oy+3), S(ox+ow-3), S(oy+oh-3)], radius=S(R-3), fill='#8f8b95')
d.rounded_rectangle([S(ox+rim), S(oy+rim), S(ox+ow-rim), S(oy+oh-rim)], radius=S(R-rim), fill='#0b0b0d')  # bezel
# screen hole
hole = Image.new('L', F.size, 255); hd = ImageDraw.Draw(hole)
hd.rounded_rectangle([S(sx), S(sy), S(sx+sw), S(sy+sh)], radius=S(sr), fill=0)
a = F.split()[3]; F.putalpha(Image.composite(a, Image.new('L', F.size, 0), hole))
d = ImageDraw.Draw(F)
# status bar strip (canvas) inside the screen, clipped to rounded top
sb = round(54*pt)
strip = Image.new('L', F.size, 0); ImageDraw.Draw(strip).rounded_rectangle([S(sx), S(sy), S(sx+sw), S(sy+sh)], radius=S(sr), fill=255)
top = Image.new('L', F.size, 0); ImageDraw.Draw(top).rectangle([S(sx), S(sy), S(sx+sw), S(sy+sb)], fill=255)
from PIL import ImageChops
m = ImageChops.multiply(strip, top)
F.paste(Image.new('RGBA', F.size, '#FCFAF8'), (0,0), m)
d = ImageDraw.Draw(F)
# Dynamic Island
iw, ih = 125*pt, 37*pt; ix = sx + (sw-iw)/2; iy = sy + 11*pt
d.rounded_rectangle([S(ix), S(iy), S(ix+iw), S(iy+ih)], radius=S(ih/2), fill='#000')
# time
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', S(17*pt*0.95))
try: font = ImageFont.truetype('/home/claude/doorstep/public/brand/fonts/Inter-Variable.ttf', S(17*pt)); font.set_variation_by_axes([650])
except Exception as e: print('font', e)
cy = sy + 30*pt
d.text((S(sx + 70*pt), S(cy)), '9:41', font=font, fill='#1A1030', anchor='mm')
ink = '#1A1030'
# signal bars
bx = sx + 292*pt
for k, hgt in enumerate([4, 6.5, 9, 11.5]):
    x = bx + k*4.6*pt
    d.rounded_rectangle([S(x), S(cy + 5.5*pt - hgt*pt), S(x + 3*pt), S(cy + 5.5*pt)], radius=S(0.8*pt), fill=ink)
# wifi
wx, wy = sx + 322*pt, cy + 5*pt
for k, r in enumerate([11, 7.5, 4]):
    d.arc([S(wx - r*pt), S(wy - r*pt - 0*pt), S(wx + r*pt), S(wy + r*pt)], 225, 315, fill=ink, width=S(2.2*pt)) if k < 2 else d.pieslice([S(wx - r*pt), S(wy - r*pt), S(wx + r*pt), S(wy + r*pt)], 225, 315, fill=ink)
# battery
btx, bty = sx + 338*pt, cy - 6*pt
d.rounded_rectangle([S(btx), S(bty), S(btx + 25*pt), S(bty + 12*pt)], radius=S(3.5*pt), outline='#8b8592', width=S(1*pt))
d.rounded_rectangle([S(btx + 2*pt), S(bty + 2*pt), S(btx + 19*pt), S(bty + 10*pt)], radius=S(2*pt), fill=ink)
d.rounded_rectangle([S(btx + 26*pt), S(bty + 4*pt), S(btx + 27.5*pt), S(bty + 8*pt)], radius=S(1*pt), fill='#8b8592')
# home indicator
hw = 134*pt; hx = sx + (sw-hw)/2; hy = sy + sh - 8*pt - 5*pt
d.rounded_rectangle([S(hx), S(hy), S(hx+hw), S(hy+5*pt)], radius=S(2.5*pt), fill='#1A1030')
F = F.resize((W, H), Image.LANCZOS)
F.save('/tmp/claude-0/iphone/frame.png')
