import axios, { AxiosResponse } from 'axios';
import fs from 'fs-extra';
import path from 'path';
import puppeteer from 'puppeteer';
import 'source-map-support/register.js';
import type devAppConfig from './471f58ab10152e8eba30197c3c2c0247.dev.json';
import winston from 'winston';

const appConfigFile =
    process.argv[2] !== undefined && process.argv[2].length > 0
        ? process.argv[2]
        : path.join(path.dirname(process.argv[1]), '471f58ab10152e8eba30197c3c2c0247.dev.json');
if (!fs.existsSync(appConfigFile)) throw new Error(`${appConfigFile} not exist`);
const appConfig: typeof devAppConfig = fs.readJsonSync(appConfigFile, { encoding: 'utf-8' });
const logFile = appConfigFile + '.log';
fs.rmSync(logFile, { force: true });
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({}),
        winston.format.errors({ stack: true }),
        winston.format.prettyPrint()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: appConfigFile + '.log',
        }),
    ],
});

const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();
await page.goto(`https://${appConfig.url}`);

async function changeLanguageToEnglish(): Promise<void> {
    logger.info('Start changeLanguageToEnglish');
    const langBtn = await page.waitForSelector('.now_lang_text');
    await langBtn!.click();
    const langOptionsSelector = 'a.yd-actionsheet-item';
    const keyword = 'English';
    await page.waitForFunction(
        ({ langOptionsSelector, keyword }) => {
            for (const el of document.querySelectorAll(langOptionsSelector)) {
                if (el.innerHTML.includes(keyword)) return true;
            }
            return false;
        },
        { timeout: 1000 },
        { langOptionsSelector, keyword }
    );
    const langOptions = await page.$$(langOptionsSelector);
    for (const el of langOptions) {
        const innerText = await el.evaluate((node) => node.innerHTML);
        if (innerText.includes(keyword)) {
            await el.evaluate((node) => (node as HTMLAnchorElement).click());
            break;
        }
    }
}

async function goToMyAccount(): Promise<void> {
    logger.info('Start goToMyAccount');
    const keyword = 'My Account';
    await page.waitForFunction(
        ({ keyword }) => {
            for (const el of document.querySelectorAll('div')) {
                if (el.innerText.includes(keyword)) return true;
            }
            return false;
        },
        {},
        { keyword }
    );
    for (const el of await page.$$('div')) {
        const innerText = await el.evaluate((node) => node.innerText);
        const firstChildNodeName = await el.evaluate((node) => node.firstChild?.nodeName);
        if (innerText.includes(keyword) && firstChildNodeName === 'IMG') {
            await el.evaluate((node) => node.click());
            break;
        }
    }
}

async function gotoLoginPage(): Promise<void> {
    logger.info('Start gotoLoginPage');
    const keyword = 'Log In/Register';
    await page.waitForFunction(
        ({ keyword }) => {
            for (const el of document.querySelectorAll('p')) {
                if (el.innerText.includes(keyword)) return true;
            }
            return false;
        },
        { timeout: 2000 },
        { keyword }
    );
    for (const el of await page.$$('p')) {
        const innerText = await el.evaluate((node) => node.innerText);
        const childrenLen = await el.evaluate((node) => node.children.length);
        if (innerText.includes(keyword) && childrenLen === 0) {
            await el.evaluate((node) => node.click());
            break;
        }
    }
}

async function enterLoginInfo(): Promise<void> {
    logger.info('Start enterLoginInfo');
    //Input Email Address
    {
        const keyword = 'Please enter your email address';
        await page.waitForFunction(
            ({ keyword }) => {
                for (const el of document.querySelectorAll('input')) {
                    if (el.placeholder.includes(keyword)) return true;
                }
                return false;
            },
            { timeout: 3000 },
            { keyword }
        );
        for (const el of await page.$$('input')) {
            const placeholder = await el.evaluate((node) => node.placeholder);
            if (placeholder.includes(keyword)) {
                await el.type(appConfig.email);
                break;
            }
        }
    }
    //Input password
    {
        const keyword = 'Please enter the password';
        await page.waitForFunction(
            ({ keyword }) => {
                for (const el of document.querySelectorAll('input')) {
                    if (el.placeholder.includes(keyword)) return true;
                }
                return false;
            },
            {},
            { keyword }
        );
        for (const el of await page.$$('input')) {
            const placeholder = await el.evaluate((node) => node.placeholder);
            if (placeholder.includes(keyword)) {
                await el.type(appConfig.password);
                break;
            }
        }
    }
}

async function login(): Promise<void> {
    logger.info('Start login');
    const maxRetry = 3;
    for (let i = 1; i <= maxRetry; i++) {
        try {
            const loginBtnNode = await page.waitForSelector('div.login_btn', { visible: true });
            loginBtnNode!.click();
            await page.waitForFunction(
                () => {
                    for (const el of document.querySelectorAll('p')) {
                        if (el.innerText.includes('Login succeed')) return true;
                    }
                    return false;
                },
                { timeout: 2000 }
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
            break;
        } catch {
            if (i < maxRetry) continue;
            else throw new Error('Cannot Login');
        }
    }
}

async function selectTrip(): Promise<void> {
    logger.info('Start selectTrip');
    await page.waitForFunction(
        ({ from, to }) => {
            for (const el of document.querySelectorAll('td > div')) {
                if (
                    el.querySelector<HTMLSpanElement>('.Set_out')?.innerText === from &&
                    el.querySelector<HTMLSpanElement>('.get_to')?.innerText === to
                )
                    return true;
            }
            return false;
        },
        {},
        { from: appConfig.from, to: appConfig.to }
    );
    for (const el of await page.$$('td > div')) {
        const from = await el.evaluate((node) => node.querySelector<HTMLSpanElement>('.Set_out')?.innerText);
        const to = await el.evaluate((node) => node.querySelector<HTMLSpanElement>('.get_to')?.innerText);
        if (from === appConfig.from && to === appConfig.to) {
            await el.evaluate((node) => (node as HTMLDivElement).click());
            break;
        }
    }
    await page.waitForSelector('div.bottom', { visible: true, timeout: 5000 });
    await new Promise((resolve) => setTimeout(resolve, 2000));
}

async function selectDate(): Promise<void> {
    logger.info('Start selectDate');
    for (let i = 1; i <= 3; i++) {
        try {
            logger.info(`Retry open date selector [${i}]`);
            const btnDate = await page.waitForSelector('span.sele_date', { visible: true, timeout: 1000 });
            await btnDate?.click();
            await page.waitForSelector('div.wh_content_all', { visible: true, timeout: 5000 });
            break;
        } catch (e) {
            if (i < 3) logger.warn(e);
            else throw e;
        }
    }
    const targetDate = new Date(appConfig.date);
    if (new Date().getMonth() !== targetDate.getMonth()) {
        await page.waitForSelector('div.wh_jiantou2', { visible: true, timeout: 2000 });
        page.evaluate(() => (document.querySelector('div.wh_jiantou2') as HTMLDivElement).click());
    }
    for (const el of await page.$$('div.wh_item_date > p')) {
        const { innerText, offsetParent } = await el.evaluate((_node) => {
            const node = _node as HTMLParagraphElement;
            return {
                innerText: node.innerText,
                offsetParent: node.offsetParent,
            };
        });
        if (offsetParent === null || Number(innerText) !== targetDate.getUTCDate()) continue;
        await el.evaluate((node) => (node as HTMLParagraphElement).click());
        break;
    }
}

async function selectDayOrNight(): Promise<void> {
    logger.info('Start selectDayOrNight');
    const btnDayNight =
        appConfig.dayOrNight === 'Nighttime'
            ? await page.waitForSelector('div.night', { visible: true, timeout: 2000 })
            : await page.waitForSelector('div.day', { visible: true, timeout: 2000 });
    await btnDayNight?.click();
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function selectTimeSlot(): Promise<void> {
    logger.info('Start selectTimeSlot');
    const bookDiv = await page.waitForSelector('div.bookLeft', { visible: true, timeout: 5000 });
    await bookDiv?.click();
    await page.waitForSelector('div.picker_box.max_width', { visible: true, timeout: 2000 });
    const rx = /\(Seat available：(\d+)\)/;
    const candidateTimeSlots = new Set<string>();
    for (const el of await page.$$('div.picker-item')) {
        const innerText = await el.evaluate((node) => (node as HTMLDivElement).innerText);
        for (const timeSlot of appConfig.timeSlots) {
            if (innerText.startsWith(timeSlot)) {
                const match = innerText.match(rx);
                if (match === null) throw new Error(`Fatal error: Regex not match [${innerText}]`);
                const availableSeat = Number(match[1]);
                if (availableSeat < appConfig.tickets.length) {
                    logger.warn(
                        `${timeSlot} availableSeat(${availableSeat}) less than number of ticket required(${appConfig.tickets.length})`
                    );
                    break;
                }
                candidateTimeSlots.add(timeSlot);
            }
        }
    }
    const targetTimeSlot = appConfig.timeSlots.filter((timeSlot) => candidateTimeSlots.has(timeSlot))[0];
    if (targetTimeSlot === undefined) throw new Error('Selected timesolts cannot be booked');
    for (const el of await page.$$('div.picker-item')) {
        const boundingBox = (await el.boundingBox())!;
        await page.mouse.click(boundingBox.x + (boundingBox.width >> 1), boundingBox.y + (boundingBox.height >> 1));
        await new Promise((resolve) => setTimeout(resolve, 200));
        const innerText = await el.evaluate((node) => (node as HTMLDivElement).innerText);
        if (!innerText.startsWith(targetTimeSlot)) continue;
        break;
    }
    for (const el of await page.$$('div.picker_title > span.no')) {
        const offsetParent = await el.evaluate((node) => (node as HTMLSpanElement).offsetParent);
        if (offsetParent === null) continue;
        await el.evaluate((node) => (node as HTMLSpanElement).click());
    }
}

async function addTickets(): Promise<void> {
    logger.info('Start addTickets');
    const nAudit = appConfig.tickets.filter((t) => t.type === 'Audit').length;
    const nSpecial = appConfig.tickets.filter((t) => t.type === 'Child/Elderly').length;
    for (const el of await page.$$('div.amount_li')) {
        const innerText = await el.evaluate((node) => (node as HTMLDivElement).innerText);
        if (innerText.startsWith('Audit')) {
            await el.evaluate((node) => (node.querySelector('span.minus') as HTMLSpanElement).click());
            for (let i = 0; i < nAudit; i++) {
                await el.evaluate((node) => (node.querySelector('span.add') as HTMLSpanElement).click());
                await new Promise((resolve) => setTimeout(resolve, 200));
            }
        } else {
            for (let i = 0; i < nSpecial; i++) {
                await el.evaluate((node) => (node.querySelector('span.add') as HTMLSpanElement).click());
                await new Promise((resolve) => setTimeout(resolve, 200));
            }
        }
    }
}

async function fillPassengerInfo(): Promise<void> {
    logger.info('Start fillPassengerInfo');
    let passengerinfoDiv = null;
    try {
        passengerinfoDiv = await page.waitForSelector('div.passengerinfo', { visible: true, timeout: 2000 });
    } catch (e) {
        logger.warn('Cannot found passengerinfo section, will not fill passengerinfo');
    }
    if (passengerinfoDiv !== null) {
        const auditInfos = appConfig.tickets.filter((t) => t.type === 'Adult');
        const specialInfos = appConfig.tickets.filter((t) => t.type === 'Child/Elderly');
        for (const el of await passengerinfoDiv.$$('div.item')) {
            const innerText = await el.evaluate((node) => (node as HTMLDivElement).innerText);
            const info = innerText.startsWith('Adult') ? auditInfos.pop()! : specialInfos.pop()!;
            const nameInputEl = await el.$('div.up input');
            nameInputEl?.type(info.name);
            const idInputEl = await el.$('div.down input');
            idInputEl?.type(info.idcardno);
        }
    }
}

async function tickAgreement(): Promise<void> {
    logger.info('Start tickAgreement');
    try {
        const btnAgree = await page.waitForSelector('span.hint_icon', { visible: true, timeout: 1000 });
        await btnAgree?.click();
        await page.waitForSelector('span.hint_icon.icon_ok', { visible: true, timeout: 1000 });
    } catch (e) {
        throw new Error('Cannot tick agreement', e instanceof Error ? e : undefined);
    }
}

async function crackChallengeAndSubmit(): Promise<void> {
    logger.info('Start crackChallengeAndSubmit');
    for (let i = 0; i < 4; i++) {
        logger.info(`Retry ${i}:`);
        const imgSelector = '[alt="验证码"]';
        await page.waitForFunction(
            ({ imgSelector }) => document.querySelector<HTMLImageElement>(imgSelector)?.height ?? 0 > 0,
            { timeout: 10000 },
            { imgSelector }
        );
        const imgNode = (await page.$(imgSelector)) as puppeteer.ElementHandle<HTMLImageElement>;
        imgNode.evaluate((node) => node.scrollIntoView());
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const challengeImg = await imgNode.screenshot({ captureBeyondViewport: false, encoding: 'base64' });
        logger.info(challengeImg);
        try {
            const inRes = await axios.post(
                'http://2captcha.com/in.php',
                {
                    key: appConfig['2captchaApiKey'],
                    method: 'base64',
                    body: challengeImg,
                    json: 1,
                    numeric: 1,
                    min_len: 4,
                    max_len: 4,
                    language: 2,
                },
                { timeout: 5000 }
            );
            logger.info(`inRes: ${JSON.stringify(inRes.data)}`);
            await new Promise((resolve) => setTimeout(resolve, 10000));
            let outRes: AxiosResponse = { data: { status: 0 } } as any;
            for (let i = 0; i < 15 && outRes.data.status === 0; i++) {
                outRes = await axios.get('http://2captcha.com/res.php', {
                    params: {
                        key: appConfig['2captchaApiKey'],
                        action: 'get',
                        id: inRes.data.request,
                        json: 1,
                    },
                });
                logger.info(`outRes [${i}]: ${JSON.stringify(outRes.data)}`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            if (outRes.data.status !== 1) throw new Error('2Captcha error');
            const challengeInput = await page.$('div.captchaBox > input');
            if (challengeInput === null) throw new Error('[div.captchaBox > input] not found');
            await challengeInput.type(outRes.data.request);
            const submitBtn = await page.$('div.bottom');
            if (submitBtn === null) throw new Error('[div.bottom] not found');
            await submitBtn.click();
            try {
                await page.waitForSelector('div.popup', { timeout: 500 });
                for (const el of await page.$$('div.popup span')) {
                    const innerText = await el.evaluate((node) => (node as HTMLDivElement).innerText);
                    if (innerText === 'Continue') {
                        el.evaluate((node) => (node as HTMLDivElement).click());
                        break;
                    }
                }
            } catch (e) {}
            let passed = false;
            try {
                await page.waitForFunction(
                    () => {
                        return ['验证码不正确', '操作频繁,请稍后再试'].includes(
                            (document.querySelector('p.yd-toast-content') as HTMLParagraphElement | null)
                                ?.innerText as never
                        );
                    },
                    { timeout: 3000 }
                );
            } catch (e) {
                passed = true;
            }
            if (!passed) throw new Error('challenge failed');
            logger.info('Challenge Passed');
            await page.waitForSelector('p.count_down', { visible: true, timeout: 5000 });
            logger.info('Success');
            break;
        } catch (e) {
            logger.warn(e);
        }
    }
}

try {
    await changeLanguageToEnglish();
    await goToMyAccount();
    await gotoLoginPage();
    await enterLoginInfo();
    await login();
    await selectTrip();
    await selectDate();
    await selectDayOrNight();
    await selectTimeSlot();
    await addTickets();
    await fillPassengerInfo();
    await tickAgreement();
    await crackChallengeAndSubmit();
} catch (e) {
    logger.error(e);
    await page.screenshot({ fullPage: true, path: appConfigFile + '.error.png' });
    await browser.close();
}
