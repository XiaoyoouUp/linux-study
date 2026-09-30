from playwright.sync_api import sync_playwright

errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))

    # 1. 首页
    page.goto('http://localhost:8123/')
    page.wait_for_load_state('networkidle')
    assert 'Linux 学练营' in page.content(), 'brand missing'
    assert page.locator('.card').count() > 3, 'home cards missing'
    page.screenshot(path='C:/ai-repo/linux-study/.shots/01-home.png', full_page=True)

    # 2. 阶段页
    page.goto('http://localhost:8123/#/stage/s1')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(400)
    assert page.locator('.lesson-row').count() >= 1, 'lesson rows missing'
    page.screenshot(path='C:/ai-repo/linux-study/.shots/02-stage.png', full_page=True)

    # 3. 课程页 + 随堂测验交互
    page.goto('http://localhost:8123/#/lesson/s1l1')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(400)
    assert 'Linux 与开源发行版' in page.content()
    assert page.locator('figure.diagram img').count() >= 1, 'diagram missing'
    assert page.locator('.quiz').count() == 1, 'quiz missing'
    # 选一个答案提交（第 1 题选 A）
    page.locator('.quiz .q-item').nth(0).locator('.q-opt').nth(0).click()
    page.locator('.quiz .q-submit').click()
    page.wait_for_timeout(200)
    assert '第 1 题' in page.content() or '解析' in page.content(), 'quiz grade failed'
    page.screenshot(path='C:/ai-repo/linux-study/.shots/03-lesson.png', full_page=True)

    # 4. 练习场：合法/非法命令 + 任务判定
    page.goto('http://localhost:8123/#/playground')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(300)
    page.fill('#pg-in', 'ls -l /etc')
    page.press('#pg-in', 'Enter')
    page.wait_for_timeout(300)
    assert 'passwd' in page.content(), 'mock listing missing'
    page.fill('#pg-in', 'grpe root /etc/hosts')
    page.press('#pg-in', 'Enter')
    page.wait_for_timeout(200)
    assert '不支持' in page.content(), 'parser error missing'
    # 任务校验：t01 列出 /etc
    page.locator('.task-item').nth(0).click()
    page.fill('#pg-in', 'ls /etc')
    page.press('#pg-in', 'Enter')
    page.wait_for_timeout(300)
    assert '任务完成' in page.content(), 'task verdict pass missing'
    page.screenshot(path='C:/ai-repo/linux-study/.shots/04-playground.png', full_page=True)

    # 5. 考试页（exam1 由内容生成）
    page.goto('http://localhost:8123/#/exam/exam1')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(300)
    if page.locator('#exam-begin').count():
        page.click('#exam-begin')
        page.wait_for_timeout(300)
        assert page.locator('.timer').count() == 1, 'timer missing'
        assert page.locator('.task-card').count() >= 1, 'exam tasks missing'
        t = page.locator('.task-card').nth(0)
        t.locator('.task-input').fill('ls /etc')
        t.locator('.task-check').click()
        page.wait_for_timeout(200)
        assert '校验' in page.content(), 'exam task check missing'
    page.screenshot(path='C:/ai-repo/linux-study/.shots/05-exam.png', full_page=True)

    # 6. 速查表
    page.goto('http://localhost:8123/#/reference')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(300)
    assert '命令速查表' in page.content()
    page.screenshot(path='C:/ai-repo/linux-study/.shots/06-reference.png', full_page=True)

    browser.close()

print('CONSOLE/PAGE ERRORS:', errors if errors else 'none')
print('ALL BROWSER CHECKS PASSED')
