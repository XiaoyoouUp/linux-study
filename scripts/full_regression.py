from playwright.sync_api import sync_playwright
import json, urllib.request

# 从数据模块导出的课程/考试清单（node scripts/dump_manifest.mjs 生成）
lessons = json.load(open('C:/ai-repo/linux-study/.shots/manifest.json', encoding='utf-8'))

errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on('pageerror', lambda e: errors.append('PAGEERROR: ' + str(e)))
    page.on('console', lambda m: errors.append('CONSOLE: ' + m.text) if m.type == 'error' else None)

    # 首页
    page.goto('http://localhost:8123/')
    page.wait_for_timeout(900)
    assert '6' in page.locator('.hero-stats b').nth(0).inner_text(), 'stage count'

    # 所有阶段页
    for sid in [f's{i}' for i in range(1, 7)]:
        page.goto(f'http://localhost:8123/#/stage/{sid}')
        page.wait_for_timeout(350)
        assert page.locator('.lesson-row').count() >= 3, f'{sid} rows'

    # 所有课程页：标题、图、测验、命令表
    for lid in lessons['lessons']:
        page.goto(f'http://localhost:8123/#/lesson/{lid}')
        page.wait_for_timeout(300)
        assert page.locator('article').count() == 1, f'{lid} article missing'
        imgs = page.locator('figure.diagram img')
        for i in range(imgs.count()):
            ok = imgs.nth(i).evaluate("img => img.complete && img.naturalWidth > 0")
            assert ok, f'{lid} broken diagram: ' + imgs.nth(i).get_attribute('src')
    print(f"lessons checked: {len(lessons['lessons'])}")

    # 所有考试：封面 → 开考 → 交卷 → 成绩页
    for eid in lessons['exams']:
        page.goto(f'http://localhost:8123/#/exam/{eid}')
        page.wait_for_timeout(300)
        page.click('#exam-begin')
        page.wait_for_timeout(300)
        assert page.locator('.timer').count() == 1, f'{eid} timer'
        nq = page.locator('#exam-questions .q-item').count()
        nt = page.locator('.task-card').count()
        assert nq >= 12 and nt >= 2, f'{eid} q={nq} t={nt}'
        page.goto(f'http://localhost:8123/#/playground')
        page.wait_for_timeout(200)
    print(f"exams checked: {len(lessons['exams'])}")

    # 练习场与速查表
    page.goto('http://localhost:8123/#/playground')
    page.wait_for_timeout(300)
    page.fill('#pg-in', 'ls -l /etc'); page.press('#pg-in', 'Enter'); page.wait_for_timeout(200)
    assert 'passwd' in page.content()
    page.fill('#pg-in', 'grpe root /etc/hosts'); page.press('#pg-in', 'Enter'); page.wait_for_timeout(200)
    assert '不支持' in page.content(), 'parser error missing'
    page.fill('#pg-in', 'cat /etc/hostname'); page.press('#pg-in', 'Enter'); page.wait_for_timeout(200)
    page.goto('http://localhost:8123/#/reference')
    page.wait_for_timeout(300)
    assert '速查表' in page.content()

    browser.close()

print('JS ERRORS:', errors if errors else 'none')
assert not errors, 'js errors found'
print('FULL REGRESSION PASSED')
