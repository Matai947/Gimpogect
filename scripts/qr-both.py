# One A4 for the desk with both QR codes side by side: the app in any phone's browser (7gym.kz) and the Android app (APK).
# Kazakh first, Russian under it. 300 dpi PNG and PDF in qr/.
#   python scripts/qr-both.py
import qrcode
from qrcode.constants import ERROR_CORRECT_M
from PIL import Image, ImageDraw, ImageFont

R = __file__.rsplit('scripts', 1)[0]
APP, APK = 'https://7gym.kz', 'https://7gym.kz/media/seven-gym.apk'
W, H = 2480, 3508
BG, GOLD, WHITE, GREY, DIM = (10, 10, 10), (209, 166, 84), (255, 255, 255), (170, 170, 170), (110, 110, 110)
F = lambda size, bold=False: ImageFont.truetype('C:/Windows/Fonts/' + ('segoeuib.ttf' if bold else 'segoeui.ttf'), size)

im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
center = lambda x, y, text, font, fill: d.text((x, y), text, font=font, fill=fill, anchor='mt')
d.polygon([(0, 0), (560, 0), (0, 560)], fill=GOLD)
d.polygon([(W, H), (W - 700, H), (W, H - 700)], fill=(28, 28, 28))

logo = Image.open(R + 'site/logo-horizontal.png').convert('RGBA')
lw = 1000
logo = logo.resize((lw, round(lw * logo.height / logo.width)), Image.LANCZOS)
im.paste(logo, ((W - lw) // 2, 200), logo)
y = 200 + logo.height + 110
center(W / 2, y, 'КЛУБТЫҢ ҚОСЫМШАСЫ', F(140, True), GOLD); y += 180
center(W / 2, y, 'Приложение клуба', F(84), WHITE); y += 150
center(W / 2, y, 'Абонемент, QR-рұқсат, кесте, жаттықтырушылар', F(52), GREY); y += 70
center(W / 2, y, 'Абонемент, QR-пропуск, расписание, тренеры', F(46), DIM); y += 150


def qr(url, side):
    q = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=10, border=4)
    q.add_data(url)
    q.make(fit=True)
    return q.make_image(fill_color='black', back_color='white').convert('RGB').resize((side, side), Image.NEAREST)


side, pad, gap = 900, 34, 160
cols = [
    (APP, 'Кез келген телефон', 'Любой телефон · iPhone', '7gym.kz', 'Браузерде ашылады · Открывается в браузере'),
    (APK, 'Android қосымшасы', 'Приложение для Android', 'Жүктеп алу · Скачать', 'Файлды ашып, орнатыңыз · Откройте файл и установите'),
]
x0 = (W - 2 * side - gap) // 2
for i, (url, kk, ru, big, hint) in enumerate(cols):
    x = x0 + i * (side + gap)
    cx = x + side / 2
    center(cx, y, kk, F(62, True), WHITE)
    center(cx, y + 80, ru, F(46), GREY)
    top = y + 180
    d.rounded_rectangle((x - pad, top - pad, x + side + pad, top + side + pad), radius=60, fill=WHITE)
    im.paste(qr(url, side), (x, top))
    center(cx, top + side + pad + 60, big, F(70, True), GOLD)
    center(cx, top + side + pad + 160, hint, F(36), DIM)
y = y + 180 + side + pad + 290

steps = [
    ('Камераны QR-кодқа бағыттаңыз', 'Наведите камеру на QR-код'),
    ('Телефон нөміріңізбен кіріңіз', 'Войдите по номеру телефона'),
    ('Абонемент пен QR-рұқсат телефоныңызда', 'Абонемент и QR-пропуск — в вашем телефоне'),
]
left = 330
for i, (kk, ru) in enumerate(steps, 1):
    d.ellipse((left, y, left + 120, y + 120), fill=GOLD)
    d.text((left + 60, y + 60), str(i), font=F(74, True), fill=BG, anchor='mm')
    d.text((left + 175, y + 2), kk, font=F(60, True), fill=WHITE)
    d.text((left + 175, y + 80), ru, font=F(46), fill=GREY)
    y += 190

center(W / 2, H - 110, 'Akkent — ул. Болтекулы 1   •   Premier — ул. Жуалы 155   •   07:00–23:00', F(42), DIM)
im.save(R + 'qr/seven-gym-both-kz-ru.png', dpi=(300, 300))
im.save(R + 'qr/seven-gym-both-kz-ru.pdf', resolution=300)
print('ok', y)
