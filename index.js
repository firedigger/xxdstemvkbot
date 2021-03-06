const request = require("request");
const fs = require('fs');
const vk = new (require('vk-io'));
const cheerio = require('cheerio');
const SerializableMap = require('./SerializableMap');
const SerializableSet = require('./SerializableSet');
const Recognize = require('recognize');
const RoleManager = require('./RoleMaganer');
const FlagCooldowner = require('./FlagCooldowner');
const config = JSON.parse(fs.readFileSync('config.json'));
const commands_filename = config.commands_filename;
const bayan_filename = config.bayan_filename;
const ignore_list_filename = config.ignore_list_filename;
const roles_filename = config.roles_filename;
const godnota_filename = config.godnota_filename;
const stationary_commands = new SerializableMap();
const bayan_checker = new SerializableSet();
const ignore_list = new SerializableSet();
const godnota = new SerializableSet();
const roles = new RoleManager();
const cooldown = new FlagCooldowner(config.cooldown);
const conf_postpic = new SerializableMap();
const weather_appid = '6c96e03be9732051d9c087b238050784';

String.prototype.strtr = function strtr(replacePairs)
{
    "use strict";
    let str = this.toString(), key, re;
    for (key in replacePairs)
    {
        if (replacePairs.hasOwnProperty(key))
        {
            re = new RegExp(key, "g");
            str = str.replace(re, replacePairs[key]);
        }
    }
    return str;
};

function hashFnv32a(str, asString, seed)
{
    let i, l, hval = (seed === undefined) ? 0x811c9dc5 : seed;

    for (i = 0, l = str.length; i < l; i++)
    {
        hval ^= str.charCodeAt(i);
        hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    if (asString)
    {
        // Convert to 8 digit hex string
        return ("0000000" + (hval >>> 0).toString(16)).substr(-8);
    }
    return (hval >>> 0) + '';
}

function initializeStructure(structure,filename, initializerList)
{
    if (fs.existsSync(filename))
    {
        structure.load_from_file(filename);
    }
    else
    {
        if (initializerList)
            structure.initializeFromArray(initializerList);
    }
}

let twitchEmotes;
initializeStructure(stationary_commands, commands_filename);
initializeStructure(bayan_checker, bayan_filename);
initializeStructure(ignore_list, ignore_list_filename);
initializeStructure(godnota, godnota_filename);
initializeStructure(roles, roles_filename, config.admins);
initializeStructure(conf_postpic, "", "");
initializeEmotes();

const defaultSubreddit = config.defaultSubreddits;
const defaultYandere = config.defaultYandere;

const dicker_photos = ["photo9680305_360353548","photo9680305_373629840","photo9680305_356010821","photo9680305_340526271","photo9680305_324159352","photo9680305_248221743","photo297755100_438730139"];

const max_bayan_counter = config.max_bayan_counter;

let bayan_counter = 0;
let command_queue = [];
let last_attach = undefined;
let self;

function getRandomInt(min, max)
{
    return Math.floor(Math.random() * (max - min)) + min;
}

function initializeEmotes()
{
    request.get("https://twitchemotes.com/api_cache/v2/global.json", function (err, res, body)
    {
        twitchEmotes = [];
        const objs = JSON.parse(body).emotes;
        for (let obj in objs)
        {
            if (objs.hasOwnProperty(obj))
            {
                twitchEmotes.push(obj);
            }
        }
        request.get("https://api.betterttv.net/2/emotes", function (err, res, body)
        {
            let emote_list = JSON.parse(body).emotes;
            for (let i in emote_list)
            {
                let emote = emote_list[i];
                twitchEmotes.push(emote.code);
            }
        });
    });
}

function shuffleString(str)
{
    return str.split('').sort(function(){return 0.5-Math.random()}).join('');
}

const intervals = new Map();
function disableAllPics()
{
    intervals.forEach((x) => clearInterval(x));
    intervals.clear();
}

setInterval(function()
{
   saveFiles();
}, 15 * 60 * 1000);

function parseRedditPost(str)
{
    try
    {
        const children = JSON.parse(str)['data']['children'];
        if (children.length == 0)
            return null;
        let pic;
        let link;
        for(let index = 0; index < children.length; index++)
        {
            const parsed_body = children[index]['data'];
            if (parsed_body['preview'] && parsed_body['preview']['images'])
                pic = parsed_body['preview']['images'][0]['source']['url'];
            link = parsed_body['permalink'];
            const title = parsed_body['title'];
            if(pic == undefined || !bayan_checker.add(hashFnv32a(pic)))
            {
                return {pic:pic,link:link,title:title};
            }
        }
    }
    catch(e)
    {
        console.log(e);
    }
    finally
    {
        return null;
    }
}

const longpoll = function (token)
{
    vk.setToken(token);
    vk.longpoll().then(() =>
    {
        console.log('Longpoll запущен!');
    }).catch((error) =>
    {
        console.log(JSON.stringify(error));
    });
};

if (config.token)
{
    longpoll(config.token);
}
else
{
    vk.setting({
        login: config.login,
        pass: config.password,
        phone: config.phone
    });

   const auth = vk.windowsAuth();
    auth.run()
        .then((user) =>
        {
            self = user.user;
            console.log('Token:', user.token);
            longpoll(user.token);
        })
        .catch((error) =>
        {
                console.log(JSON.stringify(error));
        });
}


function randomArrayElement(arr)
{
    return arr[getRandomInt(0,arr.length)];
}


//TODO rewrite into cheesio
function parseYandexNews(str)
{
    const reg_str = '<a href=.*?class="link list__item-content link_black_yes" aria-label=".*?>';

    const regexp = new RegExp(reg_str, 'g');
    let result = '';
    let i = 1;
    str.match(regexp).forEach(function (elem)
    {
        if (elem.indexOf('Изменить город') == -1)
        {

            const link_exp = new RegExp('<a href=".*?"');
            const title_exp = new RegExp('aria-label=".*?"');

            if (i <= 5 && Math.random() > 0.5) {
                result += i + '. ' + (elem.match(title_exp).toString().slice(12, -1)) + ' (' + (elem.match(link_exp).toString().slice(9, -1)) + ')' + '\n';
                i++;
            }
        }
    });
    return result;
}


function parseBashQuote(str)
{
    return str.replace('<br.+?/>','\n');
}

function saveFiles()
{
    stationary_commands.save_to_file(commands_filename);
    bayan_checker.save_to_file(bayan_filename);
    roles.save_to_file(roles_filename);
    ignore_list.save_to_file(ignore_list_filename);
    godnota.save_to_file(godnota_filename);
}

function generateRequestString(msg)
{
    return 'REQUEST: ' + msg.text + '\n';
}

function download(uri, filename, callback)
{
    request.head(uri, function (err, res, body)
    {
        request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
    });
};
/*
function SendCaptcha(src, callback)
{
    download(src, 'captcha.png', function()
    {
        fs.readFile('./captcha.png', function(err, data)
        {
            recognize.solving(data, function(err, id, code)
            {
                return callback(code,id);
            });
        });
    });
}

vk.setCaptchaHandler((src,again) =>
{
    SendCaptcha(src, function(code,id)
    {
        again(code).catch(() =>
        {
            recognize.report(id,function(err, answer)
        	{     	
                console.log("report captcha!");
            });
        });                         
    });
});
*/
const quiz_data = new Map();
const intervalPeriods = new Map();

function formatVkPhotoString(id, owner_id, access_key)
{
    return owner_id+"_"+id + (access_key ? ('_'+access_key) : '');
}

function pickLargestVkPhotoLink(photo)
{
    const links = [photo.photo_75, photo.photo_130, photo.photo_604, photo.photo_807, photo.photo_1280, photo.photo_2560];
    let i = links.length - 1;

    while(!links[i])
        --i;

    if (i < 0)
        throw new Error('No pic links available');

    return links[i];
}

/*function parseGelbooruPic(body)
{
    const $ = cheerio.load(body);

    return $('#image').attr('src');
}

function parseGelbooruPicId(body)
{
    const $ = cheerio.load(body);

    const result = [];
    $('.thumb').each(function (i,obj) {
        result.push($(obj).attr('id'));
    });

    return result;
}*/

vk.on('message',(msg) =>
{
    let callback;
    let request_str;
    let msgtext = "";
    if(msg.text != null)
        msgtext = msg.text;
    const sender = msg.user;
    const chat_id = msg.chat;
    if(msg.chat)
    {
        console.log(msgtext+" " + chat_id + " " + sender);
        if(sender != 391072775)
        conf_postpic.add(chat_id, false);
    }
    command_queue.forEach(function (elem)
    {
        if (elem.author == sender)
        {
            sendMessage('Команда ' + elem.key + (stationary_commands.has(elem.key) ? ' изменена!' : ' добавлена!'), false);
            stationary_commands.add(elem.key, {forward_messages:msg.id});
            elem.key = '';
        }
    });
    command_queue = command_queue.filter((x) => x.key != '');
    
    function getvkName(id,n_c,callback)
    {
        vk.api.users.get({
            user_ids: id,
            name_case: n_c
        }).then(function(data)
        {
            callback(data[0].first_name + " " + data[0].last_name);
        });
    }

    function sendMessage(message, copy_request)
    {
        if (copy_request === false)
            return msg.send(message,{fwd:false});
        else
            return msg.send(request_str + message,{fwd:false});
    }
    
    function sendVkPic(picLink,message)
    {
        vk.upload.message({
            file: picLink
        }).then(function(data)
        {
            const pik_id = "photo" + formatVkPhotoString(data['id'], data['owner_id']);
            last_attach = pik_id;
            return msg.send(message,{ attachment: pik_id, fwd:false});
        });
    }

    function sendMessageWithFwd(message)
    {
        return msg.send(message,{fwd:true});
    }

    function checkMinArgsNumber(args, min)
    {
        if (args.length < min)
        {
            sendMessage('Нужно минимум ' + min + ' аргументов!');
            return false;
        }
        return true;
    }

    function sendMessageObject(msgObject)
    {
        return msg.send(msgObject);
    }

    function check_stationary_command(message)
    {
        stationary_commands.forEach(function (value,key)
        {
            if (message == key)
            {
                sendMessageObject(value);
            }
        });
    }

    function isUser(sender)
    {
        return roles.checkPrivileges(sender,0);
    }

    function isModerator(sender)
    {
        return roles.checkPrivileges(sender,1);
    }

    function isAdmin(sender)
    {
        return roles.checkPrivileges(sender,2);
    }

    function checkAdminPrivileges(sender, warning)
    {
        if (isAdmin(sender))
            return true;
        if (warning)
            sendMessage('Недостаточно прав! Необходимы права администратора');
        return false;
    }

    function checkModeratorPrivileges(sender, warning)
    {
        if (isModerator(sender))
            return true;
        if (warning)
            sendMessage('Недостаточно прав! Необходимы права модератора');
        return false;
    }

    function checkUserPrivileges(sender, warning)
    {
        if (isUser(sender))
            return true;
        if (warning)
            sendMessage('Недостаточно прав! Вы лох!');
        return false;
    }
    
    function getPrivilegesName(level)
    {
       switch(level) {
           case 0: return "Пользователь";
           case 1: return "Модератор";
           case 2: return "Администратор";
           default: return "Лох";
       }
    }

    function checkIgnore(arg)
    {
        if (!arg)
            return true;
        const args = arg.split(' ');
        const ignored = false;
        args.forEach(function(element)
        {
            if (ignore_list.has(element))
            {
                sendMessage("Эта хуйня в игноре!");
                return false;
            }
        });
        return true;
    }
    
    function disablePics()
    {
        if (intervals.has(chat_id))
        {
            clearInterval(intervals.get(chat_id));
            intervals.delete(chat_id);
        }
    }

    function initQuizLeaderBoard()
    {
        quiz_data.get(chat_id).leaderboard = new Map();
        vk.api.messages.getChatUsers({chat_id:chat_id,fields:'nickname'}).then(function (data)
        {
            data.forEach(function (elem)
            {
                quiz_data.get(chat_id).leaderboard.set(elem.id,{fullname:elem.first_name + ' ' + elem.last_name,points:0});
            });
        });
    }

    function launch_question()
    {
        const line = randomArrayElement(quiz_data.get(chat_id).question_base).split('|');
        quiz_data.get(chat_id).quiz_answer = line[1].trim();
        const question = line[0] + '\n' + quiz_data.get(chat_id).quiz_answer.length + ' букв';
        quiz_data.get(chat_id).question = question;
        quiz_data.get(chat_id).quiz_hints = ['Первая буква ' + quiz_data.get(chat_id).quiz_answer.charAt(0),'Последняя буква ' + quiz_data.get(chat_id).quiz_answer.charAt(quiz_data.get(chat_id).quiz_answer.length - 1), shuffleString(quiz_data.get(chat_id).quiz_answer)];
        quiz_data.get(chat_id).quiz_msg_counter = 0;
        sendMessage('Новый вопрос викторины:\n' + question,false);
    }

    function launch_quiz()
    {
        quiz_data.set(chat_id,{question_base: String(fs.readFileSync(config.quiz_question_base_filename)).split('\n')});
        initQuizLeaderBoard();
        launch_question();
    }

    function stop_question()
    {
        quiz_data.get(chat_id).quiz_answer = undefined;
        quiz_data.get(chat_id).quiz_hints = undefined;
        quiz_data.get(chat_id).quiz_msg_counter = 0;

    }

    function stop_quiz()
    {
        stop_question();
        printLeaderBoard();
    }

    function printLeaderBoard()
    {
        let scores = 'Текущий счет:\n';
        Array.from(quiz_data.get(chat_id).leaderboard.values()).filter((x) => x.points > 0).sort(function (a, b) {
            return -(a.points - b.points);
        }).forEach((value) => scores+=value.fullname + ' ' + value.points + '\n');
        scores+='Остальные долбаебы';
        sendMessage(scores,false);
    }

    function announce_winner()
    {
        sendMessageWithFwd('Правильный ответ, поздравляем!');
        quiz_data.get(chat_id).leaderboard.get(sender).points++;
        printLeaderBoard();
    }
    

    function showNextQuizHint()
    {
        if (quiz_data.get(chat_id).quiz_hints.length > 0)
        {
            const hint = quiz_data.get(chat_id).quiz_hints[0];
            quiz_data.get(chat_id).quiz_hints.shift();
            sendMessage(hint, false);
        }
        else
        {
            sendMessage('Пиздец вы дауны лол! Правильный ответ: ' + quiz_data.get(chat_id).quiz_answer, false);
            quiz_data.get(chat_id).quiz_answer = undefined;
            setTimeout(launch_question,6*1000);
        }
    }

    function check_quiz_answer(message)
    {
        if (quiz_data.has(chat_id) && quiz_data.get(chat_id).quiz_answer)
            if(message.toLowerCase().indexOf(quiz_data.get(chat_id).quiz_answer.toLowerCase()) != -1)
            {
                stop_question();
                announce_winner();
                setTimeout(launch_question,4 * 1000);
            }
            else
            {
                quiz_data.get(chat_id).quiz_msg_counter++;
                if (quiz_data.get(chat_id).quiz_msg_counter > config.quiz_hint_threshold)
                {
                    quiz_data.get(chat_id).quiz_msg_counter = 0;
                    showNextQuizHint();
                }
            }
    }

    function postRandomPic(title)
    {
        console.log('Attempting pic request');
        
        if ((conf_postpic.get(chat_id) == false) || (!chat_id))
        {
            bayan_counter = 0;
            postPicFromService(requestRandomYanderePic,title);
        }
        
    }

    function postPicFromService(requestCallback, messageTitle)
    {

         requestCallback(function (answer)
         {
            ++bayan_counter;
             if(answer) {
             if (answer.pic)
                 answer = answer.pic;
              return sendVkPic(answer, messageTitle);
             }
         }, messageTitle);
    }

    function requestRandomRedditPic(callback)
    {
        requestReddit(randomArrayElement(defaultSubreddit),callback);
    }

    function requestRandomYanderePic(callback)
    {
        requestYandere(randomArrayElement(defaultYandere),callback);
    }

    function requestReddit(subreddit,callback)
    {
        request.get("https://www.reddit.com/r/" + subreddit + "/new/.json", function (err, res, body)
        {
            const answer = parseRedditPost(body);
            callback(answer);
        });
    }

    function requestYandere(tag, callback, page = 1)
    {
        const url = randomArrayElement(["http://konachan.com","https://yande.re"]);
        const tag_url = url + "/post?page="+page+"&tags=" + tag;
        console.log(url);
        request.get(tag_url, function (err, res, body)
        {
            bayan_counter++;
            if(bayan_counter > max_bayan_counter)
                return sendMessage('Забаянился');
            console.log("requested page "+page);
            if (body.indexOf('Nobody here but us chickens!') != -1)
            {
                request.get(url+"/tag?name=" + tag + "&type=&order=count", function (err, res, body)
                {
                    const $ = cheerio.load(body);

                    const counts = [];
                    const titles = [];

                    $('.highlightable').find('tbody').find('tr').each(function (row_i, row)
                    {
                        const tds = $(row).children();
                        tds.each(function (j, elem)
                        {
                            if (j == 0)
                            {
                                counts.push((+$(elem).text()));
                            }

                            if (j == 1)
                            {
                                $(elem).find('a').each(function (a_i, a_elem)
                                {
                                    if (a_i == 1)
                                    {
                                        titles.push($(a_elem).text());
                                    }
                                })
                            }
                        });
                    });

                    let sum = 0;
                    counts.forEach(function (x) {
                        sum += x;
                    });
                    if(sum < 1 )
                        return sendMessage('No matches found!');
                    const v = getRandomInt(0, sum);
                    let c = 0;
                    let i = 0;
                    while (c < v)
                    {
                        c += counts[i];
                        i++;
                    }
                    const fixed_tag = decodeURIComponent(titles[i]);
                    request_str += 'fixed to ' + fixed_tag + '\n';
                    requestYandere(fixed_tag, callback);
                });
            }
            else
            {
                const $ = cheerio.load(body);
                let page_count = 0;
                $("div.pagination").find("a").each(function(n, wtf) 
                {
                    if(wtf.attribs.href.startsWith("/post?page="))
                    {   
                        let pages = wtf.children[0].data;
                        if((pages.indexOf("→") < 1) && (!pages.startsWith("←"))) {
                           return page_count = pages;
                        }    
                    }   
                });
                console.log("total pages " + page_count);
                const pics = [];
                $('a.directlink.largeimg').each(function (j, elem)
                {
                    const img_link = $(elem).attr('href');
                    if(!bayan_checker.add(hashFnv32a(img_link)))
                        if(url == "http://konachan.com")
                        pics.push("http://"+img_link.substr(2));
                        else   
                        pics.push(img_link);
                });
                if (pics.length < 1)
                    if(page_count > page)
                        requestYandere(tag, callback, page+1);
                    else
                        return sendMessage('Забаянился');
            
                callback(randomArrayElement(pics));
            }
        });

    }

	function checkQuiz()
    {
        if (quiz_data.has(chat_id) && quiz_data.get(chat_id).quiz_answer)
            return true;
        else
        {
            sendMessage('Викторина не запущена!',true);
            return false;
        }
    }

    function parseWeather(city, callback)
    {
        city = city.toLowerCase();
        request.get("http://api.openweathermap.org/data/2.5/weather?q=" + encodeURIComponent(city) + "&APPID="+weather_appid, function (err, res, body)
        {
            if(body.length > 10)
                body = JSON.parse(body);
            else
                return callback("Пизда погоде че-то." );

            if (body.cod != 200)
                return callback("Хуевый город какой-то." );

            const wizz = [
                {
                "Clear": "Ясно ☀ ",
                "Cloudsovercast": "Переменная облачность ⛅ ",
                "Clouds": "Облачно ☁ ",
                "Rainlight": "Пасмурно ☁",
                "Rain": "Дождь ☔",
                "Mist": "Легкий туман 🌫",
                "Fog": "Туман 🌫",
                "Snow": "Снег ❄"
                },
                {
                4: "Дождь ☔",
                5: "Ливень ",
                7: "Снег ❄",
                8: "Гроза ⚡",
                9: "Нет данных",
                10: "Без осадков"
                }
            ];
            let weather =  body.weather[0].main.strtr(wizz[0]);
            weather += "\nВлажность: "+body.main.humidity+"%\n";
            weather += "Облачность "+ body.clouds.all +"%\n";
            weather += "Скорость ветра: "+ body.wind.speed +" м/с";
            weather += "\r\n Температура: " + Math.round(body.main.temp - 273.15) + " °C";
            callback(weather);
        });
    }

    function parseTimeNow(body)
    {
        const $ = cheerio.load(body);

        const r = $('.city_view_clock.city_clock').find('.city_clock_board').text();
        return [r.slice(0,5),r.slice(5)].join(':');
    }

    if(sender == 123835682)
    {
        console.log(twitchEmotes.length);
        for (let i in twitchEmotes)
        {
            if (msgtext.indexOf(twitchEmotes[i]) != -1)
                return msg.send("дениска еблан");
        }
    }

    if (msgtext.startsWith('!'))
    {
        const words = msgtext.split(' ');
        const command = words[0].slice(1);
        const args = words.slice(1);
        request_str = generateRequestString(msg);

        if (checkUserPrivileges(sender))
        {

            if (!checkModeratorPrivileges(sender)) {
                if (cooldown.check())
                    return;
            }
            cooldown.trigger();

            if (command == 'pic' || command == 'пик')
            {
                if (args.length == 0)
                {
                    postRandomPic(request_str);
                }
                else
                {
                    if (args[0] == 'yan')
                    {
                        callback = function (content)
                        {
                            if (content != null)
                            sendVkPic(content, request_str);
                        };

                        bayan_counter = 0;
                        if (args.length == 1)
                            requestRandomYanderePic(callback);
                        else 
                            requestYandere(args.slice(1).join(' '),callback);
                    }
                    

                    if (args[0] == 'reddit')
                    {
                        callback = function (content) {
                            sendVkPic(content.pic, request_str);
                        };

                        if (args.length == 1)
                            requestRandomRedditPic(callback);
                        else if (checkIgnore(args[1]))
                            requestReddit(args[1],callback);
                    }
     
                  /* хуй залупа  if (args[0] == 'gel')
                    {
                        var callback = function (content) {
                            sendVkPic(content,request_str);
                        };

                        if (args.length == 1)
                            requestRandomGelbooruPic(callback);
                        else if (checkIgnore(args[1]))
                            requestGelbooru(args[1],callback);
                    }*/
                    if (args[0] == 'digger' || args[0] == 'dicker' || args[0] == 'диккер' || args[0] == 'диггер')
                    {
                        sendMessageObject({message:"ееее диккер!", attachment: randomArrayElement(dicker_photos)});
                    }
                    
                    if (args[0] == 'годнота')
                    {
                        if (godnota.size() == 0)
                            return sendMessage('Годнота пустует, бро! Ты знаешь, что делать.');
                        const photo_id = godnota.pickRandom();
                        if(photo_id.sender)
                        {
                            getvkName(photo_id.sender,"Nom", function(name)
                            {
                                sendMessageObject({message: request_str + "Добавил в годноту: " + name, attachment: photo_id.last_attach});
                            });
                        }
                        else
                            sendMessageObject({message: request_str, attachment: photo_id});
                    }
                }
            }

            if (command == 'reddit')
            {
                if (checkMinArgsNumber(args,1))
                {
                    if (checkIgnore(args[1]))
                    {

                        console.log("requested reddit");
                        callback = function (content)
                        {
                            if (content == null)
                                return sendMessage("Хуевый сабреддит какой-то!");
                            if (content.pic)
                                sendVkPic(content.pic, request_str + content.title + '\n' + "https://www.reddit.com" + content.link);
                            else
                                sendMessage(content.title + '\n' + "https://www.reddit.com" + content.link);
                        };

                        requestReddit(args[0], callback);
                    }
                }
            }

            if (command == 'bash')
            {
                request.get('http://bohdash.com/random/bash/random.php', function (err, res, body)
                {
                    return sendMessage(parseBashQuote(body));
                });
            }

            if (command == 'news')
            {
                request.get('https://yandex.ru', function (err, res, body)
                {
                    return sendMessage(parseYandexNews(body));
                });
            }
            
             if (command == 'время' || command == 'time')
             {
                 if (checkMinArgsNumber(args,1))
                 {
                     request.get("http://www.timeserver.ru/city/search.html?query=" + encodeURIComponent(args[0]), function (err, res, body)
                     {
                         if (body.indexOf('Город "' + args[0] + '" не найден :(') != -1)
                             return sendMessage("Хуевый город какой-то.");
                         else
                             return sendMessage(parseTimeNow(body));
                     })
                 };
            }
            
            if (command == 'погода' || command == "weather")
            {
                if (checkMinArgsNumber(args, 1))
                {
                    parseWeather(args.slice(0).join(' '), function (pogoda)
                    {
                        sendMessage(pogoda);
                    });
                }
            }

            if (command == 'ignore_list')
            {
                sendMessage('Ignored list: ' + ignore_list.showValues(), false);
            }

            if (command == 'question')
            {
                if (checkQuiz())
                {
                    sendMessage('Текущий вопрос:\n' + quiz_data.get(chat_id).question, false);
                }
            }

            if (command == 'scores')
            {
                if (checkQuiz())
                {
                    printLeaderBoard();
                }
            }

            if (command == 'commands')
            {
                sendMessage('Доступные команды:\n' + stationary_commands.showKeys('\n'), false);
            }

            if (command == 'help')
            {
                sendMessage(config.help, false);
            }

            if (checkModeratorPrivileges(sender))
            {
                //TODO check this
                if (command == 'хуйня')
                {
                     let photo;
                       if(args.length < 1)
                           photo = last_attach;
                        else 
                            photo = args[0];
                         if (godnota.size() < 0) return sendMessage('Годнота пустует, бро! Ты знаешь, что делать.');
                        var shit;
                        godnota.forEach(function(elem) {
                             if(elem.last_attach == photo){
                                 shit = elem;
                                 console.log(elem);
                             return elem;    
                             }
                         });
                        console.log(shit);
                        if (shit == undefined) return sendMessage("Нету такого :o");
                       if(godnota.delete(shit))
                         getvkName(shit.sender,"Nom", function(name) {
                                    sendMessage("Пикча удалена с годноты, "+name + " уебан.");
                                    }); else return sendMessage('Не понял');
                }

                if (command == 'годнота')
                {   
                     let photo;
                       if(args.length < 1)
                           photo = last_attach;
                        else 
                            photo = args[0];
                     if(photo == undefined)
                      return sendMessage('Не понял');
                    last_attach = photo;
                    var shit;
                    godnota.forEach(function(elem) {
                        if(elem.last_attach == last_attach){
                            shit = elem;
                            return elem;    
                        }
                    });
                    if (shit != undefined) 
                         return getvkName(shit.sender,"Nom", function(name) {
                             sendMessage("Пикчу в годноту уже добавил "+name + ".");});
                    godnota.add({last_attach,sender});
                    sendMessage('Сохранил годноту!');
                }


                if (command == 'launch_quiz')
                {
                    launch_quiz();
                }

                if (command == 'stop_quiz')
                {
                    stop_quiz();
                    sendMessage('Викторина окончена!', false);
                }

                if (command == 'hint')
                {
                    if (checkQuiz())
                    {
                        quiz_data.get(chat_id).quiz_msg_counter = 0;
                        showNextQuizHint();
                    }
                }

                if (command == 'skip')
                {
                    if (checkQuiz())
                    {
                        quiz_data.get(chat_id).quiz_hints = [];
                        showNextQuizHint();
                    }
                }
            }

            if (checkAdminPrivileges(sender))
            {
                if (command == 'op')
                {
                    if (checkMinArgsNumber(args, 1))
                    {
                        getvkName(args[0],"Nom", function(name)
                        {
                            sendMessage( name + ' Теперь имеет права: ' + getPrivilegesName(roles.op(args[0])))
                        });
                    }
                }

                if (command == 'deop')
                {
                    if (checkMinArgsNumber(args, 1))
                    {
                        getvkName(args[0],"Nom", function(name)
                        {
                            sendMessage( name + ' Теперь имеет права: ' + getPrivilegesName(roles.deop(args[0])))
                        });
                    }
                }

                if (command == 'ban')
                {
                    if(checkMinArgsNumber(args, 1))
                    {
                        roles.setPrivileges(args[0],-1);
                        getvkName(args[0],"nom", function(name)
                        {
                            sendMessage(name+ " больше не может использовать бота!");
                        });
                    }
                }

                if (command == 'enable_pics')
                {
                    let period = config.default_picture_period;
                    if (args.length > 0)
                    {
                        period = (+args[0]);
                    }

                    if (intervals.has(chat_id))
                        sendMessage('Вообще-то модуль уже запущен, еще раз подумай.');
                    else
                    {
                        sendMessage('Пикча запущена!');
                        const title = 'Пикча каждые ' + period + ' минут.';
                        const postCallback = function(){postRandomPic(title);conf_postpic.add(chat_id,true);};
                        const interval = setInterval(postCallback, period * 60 * 1000);
                        intervals.set(chat_id, interval);
                        intervalPeriods.set(chat_id, period);
                        postCallback();
                    }
                }

                if (command == 'disable_pics')
                {
                    sendMessage('Пикча распущена!');
                    disablePics();
                }

                if (command == 'clear_history')
                {
                    sendMessage('Баяны очищены!', false);
                    bayan_checker.clear();
                }

                if (command == 'ignore_add')
                {
                    if (checkMinArgsNumber(args, 1))
                    {
                        if (!ignore_list.has(args[0]))
                        {
                            ignore_list.add(args[0]);
                            sendMessage('Добавлен игнор ' + args[0], false);
                        }
                        else
                            sendMessage(args[0] + ' уже есть в списке игнора!');
                    }

                }

                if (command == 'ignore_del')
                {
                    if (checkMinArgsNumber(args, 1))
                    {
                        if (ignore_list.has(args[0]))
                        {
                            ignore_list.delete(args[0]);
                            sendMessage('Удален игнор ' + args[0], false);
                        }
                        else
                            sendMessage(args[0] + ' нет в списке игнора!');
                    }
                }

                //TODO check
                if (command == 'addpic')
                {
                    if (checkMinArgsNumber(args, 1))
                    {
                        const id = msg.id;
                        console.log("здарова");
                        let com = {message: (args[1] ? args.slice(1).join(' ') : ''), attachment: []};
                        vk.api.messages.getById({message_ids: id}).then(function (data)
                        {
                            data.items[0].attachments.forEach(function (attachment)
                            {
                                const photo = attachment.photo;
                                console.log(photo);
                                vk.upload.message({
                                    file: pickLargestVkPhotoLink(photo)
                                }).then(function (data)
                                {
                                    const pik_id = formatVkPhotoString(data['id'], data['owner_id']);
                                    com.attachment.push('photo' + pik_id);
                                    sendMessage('Команда ' + args[0] + (stationary_commands.has(args[0]) ? ' изменена!' : ' добавлена!'), false);
                                    stationary_commands.add(args[0], com);
                                });
                            });
                        });
                    }
                }

                if (command == 'addcom')
                {
                    if (checkMinArgsNumber(args, 1))
                    {
                        let com;
                        if (args.length > 1)
                        {
                            com = {message: args.slice(1).join(' ')};
                            sendMessage('Команда ' + args[0] + (stationary_commands.has(args[0]) ? ' изменена!' : ' добавлена!'), false);
                            stationary_commands.add(args[0], com);
                        }
                        else
                        {
                            command_queue.push({author: sender, key: args[0]});
                            sendMessage('Команда ' + args[0] + ' ждет назначения следующим сообщением автора', false);
                        }

                    }
                }

                if (command == 'delcom')
                {
                    if (checkMinArgsNumber(args, 1))
                    {
                        if (stationary_commands.has(args[0]))
                        {
                            stationary_commands.delete(args[0]);
                            sendMessage('Команда ' + args[0] + ' удалена!', false);
                        }
                        else
                            return sendMessage('Команды ' + args[0] + ' нет в списке!');
                    }
                }
            }
            check_stationary_command(command);
        }
        if (command == 'role')
        {
            if (args.length > 0)
            {
                getvkName(args[0],"gen", function(name) {
                sendMessage('Уровень доступа у ' + name + ': ' + getPrivilegesName(roles.getPrivileges(args[0])))
                });
            }
            else
            {
                sendMessage('Ваш уровень доступа: ' + getPrivilegesName(roles.getPrivileges(sender)))
            }
        }
    }
    check_quiz_answer(msgtext);
});

if (process.platform === "win32")
{
    const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on("SIGINT", function ()
    {
        process.emit("SIGINT");
    });
}

process.on("SIGINT", function ()
{
    disableAllPics();
    saveFiles();
    process.exit();
});