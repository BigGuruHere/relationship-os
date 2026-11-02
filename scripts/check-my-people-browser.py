"""Local mobile smoke test: fake microphone and mocked provider-facing transcription response."""
import json,sys,time,os
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
fixture=json.load(open(sys.argv[1]))
origin=fixture['origin']
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,permissions=['microphone'],service_workers='block')
    context.add_cookies([{'name':'rsid_dev','value':fixture['cookie'],'url':origin}])
    uploads=[]
    errors=[]
    diagnostics=[]
    def route_request(route):
        url=route.request.url
        if not url.startswith(origin+'/'):
            errors.append('Unexpected nonlocal request');route.abort();return
        if '/transcription-diagnostics' in url:
            body=json.loads(route.request.post_data)
            assert 'transcript' not in body and 'text' not in body
            diagnostics.append(body)
            route.fulfill(status=204);return
        if '/people/api/upload-chunk?' in url:
            query=parse_qs(urlparse(url).query)
            index=int(query['index'][0]);assert index==len(uploads), 'audio upload order'
            assert query['mime'][0] in ('audio/webm','audio/mp4')
            uploads.append(index)
            if query['last'][0]=='1':
                assert len(uploads)>1,'audio bytes uploaded before finalization'
                route.fulfill(status=202,json={'jobId':'offline-browser-job'})
            else:
                time.sleep(.05)
                assert len(route.request.post_data_buffer)>0
                route.fulfill(status=200,json={'ok':True})
            return
        if '/people/api/transcribe-result?' in url:
            route.fulfill(status=200,json={'status':'done','transcript':'Sarah is building a cybersecurity business.'});return
        route.continue_()
    context.route('**/*',route_request)
    page=context.new_page()
    page.on('pageerror',lambda error: errors.append(str(error)))
    page.goto(origin+'/people/new')
    page.get_by_label('Name',exact=True).fill('Mobile Sarah')
    page.get_by_label('Email (optional)').fill('mobile@example.test')
    page.get_by_role('button',name='Save person',exact=True).click()
    page.wait_for_url('**/people/*')
    page.get_by_role('heading',name='Mobile Sarah',exact=True).wait_for()
    detail=page.url
    page.get_by_role('link',name='Record voice note / Add note').click()
    page.get_by_role('button',name='Start recording').click()
    page.get_by_role('button',name='Hold to stop').wait_for()
    page.wait_for_timeout(1800)
    stop=page.get_by_role('button',name='Hold to stop')
    box=stop.bounding_box()
    page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
    page.mouse.down();page.wait_for_timeout(750);page.mouse.up()
    page.wait_for_function("document.querySelector('textarea')?.value.includes('cybersecurity')")
    if os.environ.get('TRANSCRIPTION_DIAGNOSTIC_TEST')=='YES':
        page.wait_for_timeout(250)
        stages={d['stage'] for d in diagnostics}
        assert {'browser.microphone_requested','browser.record_start','browser.record_stop','browser.chunk_ready','browser.upload_complete','browser.result_received','browser.ui_applied'} <= stages, stages
        assert len({d['correlationId'] for d in diagnostics})==1
        assert all('Sarah' not in json.dumps(d) for d in diagnostics)
        print('PASS browser diagnostic stages, single correlation ID and content redaction')
    page.get_by_label('Your note',exact=True).fill('Sarah is building a cybersecurity business. I offered an introduction.')
    page.get_by_role('button',name='Save note',exact=True).click()
    page.wait_for_url(detail)
    page.get_by_text('Sarah is building a cybersecurity business. I offered an introduction.',exact=True).wait_for()
    page.reload()
    page.get_by_text('Sarah is building a cybersecurity business. I offered an introduction.',exact=True).wait_for()
    assert page.locator('body').evaluate('(e) => e.scrollWidth <= window.innerWidth'), 'mobile page fits viewport'
    page.screenshot(path='/workspace/.cloud-setup/my-people-mobile.png',full_page=True)
    page.goto(origin+'/people?q=Mobile')
    page.get_by_role('link',name='Mobile Sarah').wait_for()
    assert not errors, errors
    print('PASS mobile add, record, ordered upload, transcript edit, explicit save, reload and search')
    browser.close()
