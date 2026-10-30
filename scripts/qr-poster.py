# A4 posters for clients with the app's QR, Kazakh first and Russian under it. 300 dpi PNG (screens, chats) and PDF (print).
# The QR keeps what makes every phone read it: medium error correction, a 4-module white quiet zone, pure black on white.
#   python scripts/qr-poster.py            -> qr/seven-gym-poster-kz-ru.{png,pdf}
#   python scripts/qr-poster.py apk <url>  -> qr/seven-gym-android-apk-kz-ru.{png,pdf}
import sys
import qrcode
from qrcode.constants import ERROR_CORRECT_M
from PIL import Image, ImageDraw, ImageFont

R = __file__.rsplit('scripts', 1)[0]
APP_URL = 'https://7gym.kz'
apk = len(sys.argv) > 2 and sys.argv[1] == 'apk'
url = sys.argv[2] if apk else APP_URL
W, H = 2480, 3508
BG, GOLD, WHITE, GREY, DIM = (10, 10, 10), (209, 166, 84), (255, 255, 255), (170, 170, 170), (110, 110, 110)
F = lambda size, bold=False: ImageFont.truetype('C:/Windows/Fonts/' + ('segoeuib.ttf' if bold else 'segoeui.ttf'), size)

im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
center = lambda y, text, font, fill: d.text((W / 2, y), text, font=font, fill=fill, anchor='mt')
d.polygon([(0, 0), (560, 0), (0, 560)], fill=GOLD)
d.polygon([(W, H), (W - 700, H), (W, H - 700)], fill=(28, 28, 28))

logo = Image.open(R + 'site/logo-horizontal.png').convert('RGBA')
lw = 1100
logo = logo.resize((lw, round(lw * logo.height / logo.width)), Image.LANCZOS)
im.paste(logo, ((W - lw) // 2, 230), logo)
y = 230 + logo.height + 120
center(y, 'ANDROID ҚОСЫМШАСЫ' if apk else 'КЛУБТЫҢ ҚОСЫМШАСЫ', F(150, True), GOLD); y += 190
center(y, 'Приложение для Android' if apk else 'Приложение клуба', F(90), WHITE); y += 170

q = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=10, border=4)
q.add_data(url)
q.make(fit=True)
side = 1250
code = q.make_image(fill_color='black', back_color='white').convert('RGB').resize((side, side), Image.NEAREST)
pad = 40
d.rounded_rectangle(((W - side) // 2 - pad, y - pad, (W + side) // 2 + pad, y + side + pad), radius=70, fill=WHITE)
im.paste(code, ((W - side) // 2, y))
y += side + pad + 90
center(y, 'Жүктеп алу · Скачать' if apk else '7gym.kz', F(84, True), GOLD); y += 190

steps = (
    [('Камераны QR-кодқа бағыттап, файлды жүктеңіз', 'Наведите камеру на QR-код и скачайте файл'), ('Файлды ашып, орнатуға рұқсат беріңіз', 'Откройте файл и разрешите установку'), ('Телефон нөміріңізбен кіріңіз', 'Войдите по номеру телефона')]
    if apk
    else [('Камераны QR-кодқа бағыттаңыз', 'Наведите камеру на QR-код'), ('Телефон нөміріңізбен кіріңіз', 'Войдите по номеру телефона'), ('Абонемент пен QR-рұқсат телефоныңызда', 'Абонемент и QR-пропуск — в вашем телефоне')]
)
left = 330
for i, (kk, ru) in enumerate(steps, 1):
    d.ellipse((left, y, left + 130, y + 130), fill=GOLD)
    d.text((left + 65, y + 65), str(i), font=F(80, True), fill=BG, anchor='mm')
    d.text((left + 190, y + 2), kk, font=F(66, True), fill=WHITE)
    d.text((left + 190, y + 86), ru, font=F(50), fill=GREY)
    y += 205

y += 30
pills = ['Тек Android үшін · Только для Android'] if apk else ['Кесте · Расписание', 'Жаттықтырушылар · Тренеры', 'Дүкен · Магазин']
pf = F(46)
widths = [d.textlength(p, font=pf) + 90 for p in pills]
gap = 36
x = (W - sum(widths) - gap * (len(pills) - 1)) / 2
for p, w in zip(pills, widths):
    d.rounded_rectangle((x, y, x + w, y + 100), radius=50, outline=GOLD, width=4)
    d.text((x + w / 2, y + 50), p, font=pf, fill=WHITE, anchor='mm')
    x += w + gap
center(H - 110, 'Akkent — ул. Болтекулы 1   •   Premier — ул. Жуалы 155   •   07:00–23:00', F(42), DIM)

name = 'seven-gym-android-apk-kz-ru' if apk else 'seven-gym-poster-kz-ru'
im.save(R + f'qr/{name}.png', dpi=(300, 300))
im.save(R + f'qr/{name}.pdf', resolution=300)
print(name, url)
