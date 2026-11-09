"""Offline local mobile test of both sides of profile detail sharing and the existing shared recorder."""
import json,sys,time
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
f=json.load(open(sys.argv[1]));origin=f['origin']
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
    anonymous=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block')
    owner=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,permissions=['microphone'],service_workers='block')
    owner.add_cookies([{'name':'rsid_dev','value':f['ownerCookie'],'url':origin}])
    errors=[];chunks=[]
    def intercept(route):
        url=route.request.url
        if not url.startswith(origin+'/'):
            errors.append('unexpected external request');route.abort();return
        if '/people/api/upload-chunk?' in url:
            q=parse_qs(urlparse(url).query);index=int(q['index'][0]);assert index==len(chunks);chunks.append(index)
            route.fulfill(status=202 if q['last'][0]=='1' else 200,json={'jobId':'offline-stage2'} if q['last'][0]=='1' else {'ok':True});return
        if '/people/api/transcribe-result?' in url:
            route.fulfill(status=200,json={'status':'done','transcript':'I met Jordan at the walk.'});return
        if '/notes/summarize' in url:
            assert json.loads(route.request.post_data)['text']=='I met Jordan at the walk.'
            route.fulfill(status=200,json={'summary':'We met at the walk.'});return
        route.continue_()
    for context in [anonymous,owner]:context.route('**/*',intercept)
    visitor=anonymous.new_page();visitor.on('pageerror',lambda e: errors.append(str(e)))
    visitor.goto(origin+'/u/'+f['slug']+'?via=qr')
    with visitor.expect_download():
        visitor.get_by_role('link',name='Save contact',exact=True).click()
    visitor.wait_for_url('**/share-details?via=qr')
    # Check the actual consent row under the shared global input styles on mobile.
    checkbox=visitor.locator('.capture-consent input[type=checkbox]').bounding_box()
    consent_text=visitor.locator('.capture-consent span').bounding_box()
    assert checkbox['width']<=24 and consent_text['width']>200
    visitor.get_by_label('Your name',exact=True).fill('Mobile Jordan')
    visitor.get_by_label('Email (optional)').fill('jordan@example.test')
    visitor.get_by_role('checkbox').check();visitor.get_by_role('button',name='Send',exact=True).click()
    visitor.get_by_role('heading',name='Your next introduction starts here.',exact=True).wait_for()
    visitor.get_by_role('status').get_by_text('Your details have been shared',exact=False).wait_for()
    assert visitor.locator('body').evaluate('(e)=>e.scrollWidth<=window.innerWidth')
    # A successful share survives Maybe later and the next contact download.
    visitor.get_by_role('link',name='Maybe later',exact=True).click()
    with visitor.expect_download():
        visitor.get_by_role('link',name='Save contact',exact=True).click()
    visitor.wait_for_url('**/share-details?via=*')
    visitor.get_by_role('heading',name='Your next introduction starts here.',exact=True).wait_for()
    assert visitor.locator('input[name=contactConsent]').count()==0
    page=owner.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(origin+'/people?q=Mobile%20Jordan');page.get_by_role('link',name='Mobile Jordan',exact=False).click()
    page.wait_for_url('**/people/*');page.get_by_role('heading',name='Mobile Jordan',exact=True).wait_for()
    detail=page.url;page.get_by_role('link',name='Record voice note / Add note').click()
    page.get_by_role('button',name='Start recording').click();stop=page.get_by_role('button',name='Hold to stop');stop.wait_for();page.wait_for_timeout(1300)
    box=stop.bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.wait_for_timeout(750);page.mouse.up()
    page.wait_for_function("document.querySelector('textarea#text')?.value==='I met Jordan at the walk.'")
    page.get_by_role('button',name='Summarize',exact=False).click();page.get_by_label('Summary (editable)',exact=True).wait_for()
    page.get_by_label('Summary (editable)',exact=True).fill('We met at the walk; I offered an introduction.')
    page.get_by_role('button',name='Save note',exact=True).click();page.wait_for_url(detail)
    page.get_by_text('We met at the walk; I offered an introduction.',exact=True).wait_for();page.reload();page.get_by_text('I met Jordan at the walk.',exact=True).wait_for()
    page.get_by_text('We met at the walk; I offered an introduction.',exact=True).wait_for()
    assert page.locator('body').evaluate('(e)=>e.scrollWidth<=window.innerWidth')
    assert len(chunks)>1;assert not errors,errors
    print('PASS mobile anonymous detail sharing, existing recorder, optional editable summary and retrieval')
    browser.close()
