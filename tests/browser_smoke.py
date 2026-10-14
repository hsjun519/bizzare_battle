"""Functional browser checks. Run against `npm run dev` with Playwright installed."""
import os
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BATTLE_URL', 'http://127.0.0.1:3000')
OUT = Path(__file__).resolve().parent.parent / 'test-results'
OUT.mkdir(exist_ok=True)


def check(condition, message):
    if not condition:
        raise AssertionError(message)
    print(f'PASS: {message}', flush=True)


with sync_playwright() as p:
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or p.chromium.executable_path
    browser = p.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1100})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.clock.install()
    page.add_init_script('let battleSeed=7; Math.random=()=>{battleSeed=battleSeed*16807%2147483647;return battleSeed/2147483647;}')
    page.goto(BASE)
    page.clock.run_for(150)
    check(page.locator('.fighter-card').count() == 6, 'six fighter cards load')
    for i, name in enumerate(['젠슨 황', '일론 머스크', '소크라테스', '플라톤', '니체', '워런 버핏']):
        page.locator('.fighter-card').nth(i).click()
        check(page.locator('#fighter-name').inner_text() == name, f'{name} selection updates character details')
    check(page.locator('.fighter-card[aria-pressed=true]').count() == 1, 'exactly one fighter selected')
    page.locator('#help-button').click()
    check(page.locator('#help-dialog').is_visible(), 'help dialog opens')
    page.locator('#help-done').click()
    page.locator('#sound-button').click()
    check(page.locator('#sound-button').get_attribute('aria-pressed') == 'true', 'sound can be enabled')
    page.locator('#sound-button').click()

    page.locator('.fighter-card').nth(0).click()
    page.locator('#difficulty').select_option('hard')
    page.locator('#stage').select_option('city')
    page.clock.run_for(100)
    check(page.locator('#stage-label').inner_text() == 'CAPITAL SKYLINE', 'stage selection updates preview')
    page.screenshot(path=str(OUT / 'desktop.png'), full_page=True)
    page.locator('#start-button').click()
    page.clock.run_for(2600)
    check(page.locator('#hud').is_visible() and not page.locator('#game-overlay').is_visible(), 'countdown starts a real CPU match')
    page.keyboard.down('KeyL')
    page.clock.run_for(1500)
    page.keyboard.up('KeyL')
    check(int(page.locator('#p2-health').get_attribute('aria-valuenow')) < 100, 'player special damages the CPU')
    check('CHARGING' in page.locator('#p1-meter-label').inner_text(), 'special consumes player meter')
    page.screenshot(path=str(OUT / 'battle.png'), full_page=True)
    page.keyboard.press('Escape')
    page.clock.run_for(50)
    timer = page.locator('#timer').inner_text()
    page.clock.run_for(3000)
    check(page.locator('#timer').inner_text() == timer and page.locator('#overlay-title').inner_text() == 'PAUSED', 'pause freezes match timer')
    page.locator('#continue-button').click()
    page.clock.run_for(1200)
    check(page.locator('#timer').inner_text() != timer, 'resume continues the match')

    # The CPU must finish a match against a stationary player, using real AI/damage.
    for _ in range(12):
        if page.locator('#game-overlay').get_attribute('data-state') == 'finished':
            break
        page.clock.run_for(10000)
    check(page.locator('#game-overlay').get_attribute('data-state') == 'finished', 'CPU match reaches a best-of-three result')
    check('WINS!' in page.locator('#overlay-title').inner_text(), 'winner is displayed')
    page.locator('#continue-button').click()
    page.clock.run_for(2700)
    check(page.locator('#p1-health').get_attribute('aria-valuenow') == '100', 'rematch resets player health')
    page.keyboard.press('Escape')
    page.clock.run_for(50)
    page.locator('#roster-button').click()
    check(page.locator('#preview-overlay').is_visible() and page.locator('#start-button').is_enabled(), 'return to roster unlocks setup')

    page.locator('.fighter-card').nth(2).click()
    page.locator('#mode').select_option('local')
    page.locator('#opponent').select_option('plato')
    page.locator('#stage').select_option('academy')
    check(page.locator('#difficulty').is_disabled(), 'local match does not use CPU difficulty')
    page.locator('#start-button').click()
    page.clock.run_for(2600)
    page.keyboard.down('KeyL')
    page.keyboard.down('Digit3')
    page.clock.run_for(1600)
    page.keyboard.up('KeyL')
    page.keyboard.up('Digit3')
    check(int(page.locator('#p1-health').get_attribute('aria-valuenow')) < 100 and int(page.locator('#p2-health').get_attribute('aria-valuenow')) < 100, 'both local players can independently attack')
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    page.clock.run_for(50)
    check(page.locator('#overlay-title').inner_text() == 'PAUSED', 'losing focus automatically pauses')
    page.locator('#roster-button').click()
    page.reload()
    page.clock.run_for(100)
    check(page.locator('#fighter-name').inner_text() == '소크라테스' and page.locator('#mode').input_value() == 'local', 'settings survive reload')
    check(not errors, f'no JavaScript errors ({errors})')

    mobile = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    mobile_page = mobile.new_page()
    mobile_page.on('pageerror', lambda error: errors.append(str(error)))
    mobile_page.clock.install()
    mobile_page.goto(BASE)
    mobile_page.clock.run_for(150)
    check(mobile_page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'mobile layout has no horizontal overflow')
    mobile_page.screenshot(path=str(OUT / 'mobile.png'), full_page=True)
    mobile_page.locator('#difficulty').select_option('easy')
    mobile_page.locator('#start-button').tap()
    mobile_page.clock.run_for(2800)
    check(mobile_page.locator('#touch-controls').is_visible(), 'mobile exposes touch controls')
    check(mobile_page.locator('#touch-controls').evaluate('(el) => el.getBoundingClientRect().bottom <= innerHeight') and mobile_page.locator('#arena').evaluate('(el) => el.getBoundingClientRect().top >= 0'), 'mobile arena and touch controls fit together on screen')
    button = mobile_page.locator('[data-control=special]')
    button.dispatch_event('pointerdown', {'pointerId': 1, 'pointerType': 'touch'})
    mobile_page.clock.run_for(1500)
    button.dispatch_event('pointerup', {'pointerId': 1, 'pointerType': 'touch'})
    check('CHARGING' in mobile_page.locator('#p1-meter-label').inner_text(), 'touch special triggers a real attack')
    check(not errors, f'no desktop or mobile JavaScript errors ({errors})')
    mobile_page.screenshot(path=str(OUT / 'mobile-battle.png'), full_page=True)
    browser.close()
    print('Browser smoke checks completed.', flush=True)
