const request = require("request");
const fs = require('fs');
const vk = new (require('vk-io'));
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

var stationary_commands = new SerializableMap();
var bayan_checker = new SerializableSet();
var ignore_list = new SerializableSet();
var godnota = new SerializableSet();
var roles = new RoleManager();
var cooldown = new FlagCooldowner(config.cooldown);

function hashFnv32a(str, asString, seed)
{

    var i, l,
        hval = (seed === undefined) ? 0x811c9dc5 : seed;

    for (i = 0, l = str.length; i < l; i++) {
        hval ^= str.charCodeAt(i);
        hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    if( asString ){
        // Convert to 8 digit hex string
        return ("0000000" + (hval >>> 0).toString(16)).substr(-8);
    }
    return (hval >>> 0) + '';
    //return str;
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

initializeStructure(stationary_commands, commands_filename);
initializeStructure(bayan_checker, bayan_filename);
initializeStructure(ignore_list, ignore_list_filename);
initializeStructure(godnota, godnota_filename);
initializeStructure(roles, roles_filename, config.admins);


const defaultSubreddit = config.defaultSubreddits;
const defaultYandere = config.defaultYandere;

const dicker_photos = ["photo9680305_360353548","photo9680305_373629840","photo9680305_356010821","photo9680305_340526271","photo9680305_324159352","photo9680305_248221743","photo297755100_438730139"];
const max_bayan_counter = 25;

var command_queue = [];
var last_attach = undefined;
function getRandomInt(min, max)
{
    return Math.floor(Math.random() * (max - min)) + min;
}

function shuffleString(str) {
    return str.split('').sort(function(){return 0.5-Math.random()}).join('');
}

function disableAllPics()
{
    intervals.forEach((x) => clearInterval(x));
    intervals.clear();
}

function parseYanderesPic(str)
{
    const reg_str = '<a class="directlink largeimg" href=.*?><span class="directlink-info">';

    var regexp = new RegExp(reg_str,'g');
    var result = [];
    str.match(regexp).forEach(function (elem)
    {
        result.push(elem.toString().slice(37,-32));
    });
    return result;
}

function parseRedditPic(str)
{
    var children = JSON.parse(str)['data']['children'];

    var index = getRandomInt(0, children.length);

    var pic = undefined;
    var parsed_body = children[index]['data'];
    if (parsed_body['preview'] && parsed_body['preview']['images'])
    {
        pic = parsed_body['preview']['images'][0]['source']['url'];
        var link = parsed_body['permalink'];
    }
    var title = parsed_body['title'];
    return {pic:pic,link:link,title:title};
}

var longpoll = function (token) {
    vk.setToken(token);
    vk.longpoll().then(() =>
    {
        console.log('Longpoll запущен!');
    }).catch((error) => {
        if (error.redirect_uri)
            console.log(error + '\n' + error.redirect_uri);
        else
        {
            console.log(error);
        }
    });
};

if (config.token) {
    longpoll(config.token);
}
else {
    const auth = vk.standloneAuth();
    vk.setting({
        app: config.app,
        login: config.login,
        pass: config.password,
        phone: config.phone
    });
    auth.run()
        .then((token) => {
            console.log('Token:', token);
            longpoll(token);
        })
        .catch((error) => {
            if (error.redirect_uri)
                console.log(error + '\n' + error.redirect_uri);
            else
            {
                console.log(JSON.stringify(error));
            }
        });
}

var recognize = new Recognize('rucaptcha', {
    key: config.rucaptcha
});

recognize.balanse(function(price)
{
    console.log('RuCaptcha Balance: ', price);
});
function randomArrayElement(arr)
{
    return arr[getRandomInt(0,arr.length)];
}

function parseYandexNews(str)
{
    const reg_str = '<a href=.*?class="link list__item-content link_black_yes" aria-label=".*?>';

    var regexp = new RegExp(reg_str,'g');
    var result = '';
    var i = 1;
    str.match(regexp).forEach(function (elem)
    {
        if (elem.indexOf('Изменить город') == -1) {

            var link_exp = new RegExp('<a href=".*?"');
            var title_exp = new RegExp('aria-label=".*?"');

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

var download = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

function SendCaptcha(src, callback){
    download(src, 'captcha.png', function(){
 fs.readFile('./captcha.png', function(err, data){
    recognize.solving(data, function(err, id, code)
    {
        return callback(code,id);
         });
    });
});
    
}

vk.setCaptchaHandler((src,again) => {
    SendCaptcha(src, function(code,id) { 
        again(code)
        .catch(() => {
            recognize.report(id,function(err, answer)
        	{     	
            console.log("report captcha!");
                });
        });                         
    });
});

var quiz_data = new Map();

var intervals = new Map();

function formatVkPhotoString(id, owner_id, access_key)
{
    return owner_id+"_"+id + (access_key ? ('_'+access_key) : '');
}

function pickLargestVkPhotoLink(photo)
{
    var links = [photo.photo_75, photo.photo_130, photo.photo_604, photo.photo_807, photo.photo_1280, photo.photo_2560];
    var i = links.length - 1;
    while(!links[i])
        --i;

    if (i < 0)
        throw new Error('No pic links available');

    return links[i];
}

vk.on('message',(msg) =>
{
    var msgtext = "";
    if(msg.text != null)
        msgtext = msg.text;
    var sender = msg.user;
    var chat_id = msg.chat;

    command_queue.forEach(function (elem) {
        if (elem.author == sender)
        {
            sendMessage('Команда ' + elem.key + (stationary_commands.has(elem.key) ? ' изменена!' : ' добавлена!'), false);
            stationary_commands.add(elem.key, {forward_messages:msg.id});
            elem.key = '';
        }
    });
    command_queue = command_queue.filter((x) => x.key != '');

    function sendVkPic(picLink,message)
    {
        vk.upload.message({
            file: picLink
        }).then(function(data) {
            var pik_id ="photo"+formatVkPhotoString(data['id'],data['owner_id']);
          last_attach = pik_id;
            return msg.send(message,{ attach: pik_id, fwd:false});
        });
    }
    
    function getvkName(id,n_c,callback) {
        vk.api.users.get({
            user_ids: id,
            name_case: n_c
        }).then(function(data) {
            return callback(data[0].first_name + " " + data[0].last_name);
    });
        }
                

    function sendMessage(message, copy_request)
    {
        if (copy_request === false)
            return msg.send(message,{fwd:false});
        else
            return msg.send(request_str + message,{fwd:false});
    }

    function sendMessageWithFwd(message)
    {
        return msg.send(message,{fwd:true});
    }

    function processContent(contentRetrieval,contentSender, bayanCheck)
    {
        try
        {
            var answer = undefined;
            var i = 0;
            while(!answer || bayanCheck(answer))
            {
                answer = contentRetrieval();
                i++;
                if (i > max_bayan_counter)
                    break;
            }
            if (i > max_bayan_counter)
                sendMessage('Забаянился');
            else
                contentSender(answer);
        }
        catch (err)
        {
            sendMessage("хуйня какая-та!" + '\n' + err.message);
        }
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
        if (ignore_list.has(arg) && !checkAdminPrivileges(sender))
            sendMessage("Эта хуйня в игноре!");
        else
            return true;
        return false;
    }

    function processYandereRequest(body)
    {
        processContent(function () {
            return randomArrayElement(parseYanderesPic(body));
        },function (answer) {
            sendVkPic(answer,request_str);
        },function (answer) {
            return bayan_checker.add(hashFnv32a(answer));
        });
    }

    function parseForwardedMessagesIds(fwds)
    {
        return fwds.map(function (elem) {
            return elem.id;
        }).join(',');
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
        var line = randomArrayElement(quiz_data.get(chat_id).question_base).split('|');

        quiz_data.get(chat_id).quiz_answer = line[1].trim();
        var question = line[0] + '\n' + quiz_data.get(chat_id).quiz_answer.length +' букв';
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
        var scores = 'Текущий счет:\n';
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
            var hint = quiz_data.get(chat_id).quiz_hints[0];
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

    function postRandomPic()
    {
        request.get("https://yande.re/post?tags=" + randomArrayElement(defaultYandere), function (err, res, body)
        {
            processContent(function () {
                return randomArrayElement(parseYanderesPic(body));
            },function (answer) {
                sendVkPic(answer,"Пикча каждые " + config.picture_period + " минут");
            },function (answer) {
                return bayan_checker.add(hashFnv32a(answer));
            });
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

    if (msgtext.startsWith('!'))
    {
        var words = msgtext.split(' ');
        var command = words[0].slice(1);
        var args = words.slice(1);
        var request_str = generateRequestString(msg);

        if (checkUserPrivileges(sender))
        {

            if (!checkModeratorPrivileges(sender)) {
                if (cooldown.check())
                    return;
            }
            cooldown.trigger();

            if (command == 'yan') {
                if (args.length == 0) {
                    args = [randomArrayElement(defaultYandere)];
                    request_str += 'fixed to ' + args[0] + '\n';
                }
                if (checkIgnore(args[0])) {
                    if (args[0] == 'digger' || args[0] == 'dicker_photos' || args[0] == 'диккер') {
                        sendMessageObject({message:"ееее диккер!", attach: randomArrayElement(dicker_photos)});
                        return;
                    }
                    if (args[0] == 'годнота')
                    {
                        if (godnota.size() > 0) {
                            var photo_id = godnota.pickRandom();
                            sendMessageObject({attach: photo_id});
                        }
                        else
                        {
                            sendMessage('Годнота пустует, бро');
                        }
                        return;
                    }
                    request.get("https://yande.re/post?tags=" + args[0], function (err, res, body) {
                        if (body.indexOf('Nobody here but us chickens!') != -1) {
                            request.get("https://yande.re/tag?name=" + args[0] + "&type=&order=count", function (err, res, body) {
                                //console.log(body);
                                var elem_exp = /<td align="right">[^]*?>\?<\/a>/g;

                                var count_exp = '<td align="right">.*?</td>';
                                var title_exp = /title=.*?>/i;

                                var matches = body.match(elem_exp);

                                //console.log(matches);

                                var counts = [];
                                var sum = 0;
                                var titles = [];

                                if (!matches) {
                                    sendMessage('No matches found!');
                                    return;
                                }

                                matches.forEach(function (elem) {
                                    //console.log(elem);
                                    var count = (+elem.match(new RegExp(count_exp)).toString().slice(6, -2));
                                    var title = elem.match(new RegExp(title_exp)).toString().slice(6, -2);

                                    counts.push(count);
                                    titles.push(title);
                                    sum += count;

                                });

                                //console.log(titles);

                                var v = getRandomInt(0, sum);

                                var c = 0;
                                var i = 0;
                                while (c < v) {
                                    c += counts[i];
                                    i++;
                                }

                                args[0] = titles[i];

                                request_str += 'fixed to ' + decodeURIComponent(args[0]) + '\n';

                                request.get("https://yande.re/post?tags=" + args[0], function (err, res, body) {
                                    processYandereRequest(body);
                                });
                            });
                        }
                        else {
                            processYandereRequest(body);
                        }
                    });
                }
            }

            if (command == 'pic' || command == 'пик') {
                if (args.length == 0) {
                    args = [randomArrayElement(defaultSubreddit)];
                    request_str += 'fixed to ' + args[0] + '\n';
                }
                if (checkIgnore(args[0])) {
                    request.get("https://www.reddit.com/r/" + args[0] + "/new/.json", function (err, res, body) {
                        processContent(function () {
                            return parseRedditPic(body, getRandomInt(0, 25));
                        }, function (answer) {
                            if (answer.pic)
                                sendVkPic(answer.pic, request_str + answer.title + '\n' + "https://www.reddit.com" + answer.link);
                            else
                                sendMessage(request_str + answer.title + '\n' + "https://www.reddit.com" + answer.link);
                        }, function (answer) {
                            return bayan_checker.add(hashFnv32a(answer.link));
                        });
                    });
                }
            }

            if (command == 'bash') {
                request.get('http://bohdash.com/random/bash/random.php', function (err, res, body) {
                    processContent(function () {
                            return parseBashQuote(body);
                        }, sendMessage,
                        function (answer) {
                            return bayan_checker.add(hashFnv32a(answer));
                        });
                });
            }

            if (command == 'news') {
                request.get('https://yandex.ru', function (err, res, body) {
                    processContent(function () {
                        return parseYandexNews(body);
                    }, sendMessage, function (answer) {
                        return bayan_checker.add(hashFnv32a(answer));
                    });
                });
            }

            if (command == 'ignore_list') {
                sendMessage('Ignored list: ' + ignore_list.showValues(), false);
            }

            if (command == 'question') {
                if (checkQuiz()) {
                    sendMessage('Текущий вопрос:\n' + quiz_data.get(chat_id).question, false);
                }
            }

            if (command == 'scores') {
                if (checkQuiz()) {
                    printLeaderBoard();
                }
            }
            
           

            if (command == 'commands') {
                sendMessage('Доступные команды:\n' + stationary_commands.showKeys('\n'), false);
            }

            if (command == 'help') {
                sendMessage(config.help, false);
            }

            if (checkModeratorPrivileges(sender)) {
                 if (command == 'годнота')
            {
                if(last_attach != undefined)
                {
                    if (!godnota.add(last_attach))
                    {
                        sendMessage('Сохранил годноту!');
                    }
                    else
                    {
                        sendMessage('Уже сохранил бро!');
                    }
                }
                else
                {
                    sendMessage('Не понял');
                }
            }
                if (command == 'launch_quiz') {
                    launch_quiz();
                }

                if (command == 'stop_quiz') {
                    stop_quiz();
                    sendMessage('Викторина окончена!', false);
                }
                if (command == 'hint') {
                    if (checkQuiz()) {
                        quiz_data.get(chat_id).quiz_msg_counter = 0;
                        showNextQuizHint();
                    }
                }
                if (command == 'skip') {
                    if (checkQuiz()) {
                        quiz_data.get(chat_id).quiz_hints = [];
                        showNextQuizHint();
                    }
                }
            }
            if (checkAdminPrivileges(sender)) {
                if (command == 'op') {
                    if (checkMinArgsNumber(args, 1)) {
                                        getvkName(args[0],"Nom", function(name) {
                sendMessage( name + ' Теперь имеет права: ' + getPrivilegesName(roles.op(args[0])))
                });
                    }
                }

                if (command == 'deop') {
                    if (checkMinArgsNumber(args, 1)) {
                           getvkName(args[0],"Nom", function(name) {
                sendMessage( name + ' Теперь имеет права: ' + getPrivilegesName(roles.deop(args[0])))
                });
                    }
                }
                if (command == 'ban'){
                    if(checkMinArgsNumber(args, 1)) {
                        roles.setPrivileges(args[0],-1);
                         getvkName(args[0],"nom", function(name) {
                        sendMessage(name+ " больше не может использовать бота!");
                         });
                    }
                }

                if (command == 'enable_pics') {
                    if (intervals.has(chat_id))
                        sendMessage('Вообще-то модуль уже запущен, еще раз подумай.');
                    else {
                        sendMessage('Пикча запущена!');
                        intervals.set(chat_id, setInterval(postRandomPic, config.picture_period * 60 * 1000));
                        postRandomPic();
                    }
                }

                if (command == 'disable_pics') {
                    sendMessage('Пикча распущена!');
                    disablePics();
                }

                if (command == 'clear_history') {
                    sendMessage('Баяны очищены!', false);
                    bayan_checker.clear();
                }


                if (command == 'ignore_add') {
                    if (checkMinArgsNumber(args, 1)) {
                        if (!ignore_list.has(args[0])) {
                            ignore_list.add(args[0]);
                            sendMessage('Добавлен игнор ' + args[0], false);
                        }
                        else
                            sendMessage(args[0] + ' уже есть в списке игнора!');
                    }

                }

                if (command == 'ignore_del') {
                    if (checkMinArgsNumber(args, 1)) {
                        if (ignore_list.has(args[0])) {
                            ignore_list.delete(args[0]);
                            sendMessage('Удален игнор ' + args[0], false);
                        }
                        else
                            sendMessage(args[0] + ' нет в списке игнора!');
                    }
                }

                if (command == 'addpic') {
                    if (checkMinArgsNumber(args, 1)) {

                        var id = msg.id;

                        var com = {message: (args[1] ? args.slice(1).join(' ') : ''), attach: []};

                        vk.api.messages.getById({message_ids: msg.id}).then(function (data) {
                            data.items[0].attachments.forEach(function (attachment) {
                                var photo = attachment.photo;
                                //var str = 'photo'+formatVkPhotoString(photo.id,photo.owner_id,photo.access_key);
                                vk.upload.message({
                                    file: pickLargestVkPhotoLink(photo)
                                }).then(function (data) {
                                    var pik_id = formatVkPhotoString(data['id'], data['owner_id']);
                                    com.attach.push('photo' + pik_id);
                                });
                                sendMessage('Команда ' + args[0] + (stationary_commands.has(args[0]) ? ' изменена!' : ' добавлена!'), false);
                                stationary_commands.add(args[0], com);
                            });
                        });
                    }
                }

                if (command == 'addcom') {
                    if (checkMinArgsNumber(args, 1)) {

                        var com;

                        if (args.length > 1) {
                            //parseForwardedMessagesIds(msg.fwd)
                            com = {message: args.slice(1).join(' ')};
                            sendMessage('Команда ' + args[0] + (stationary_commands.has(args[0]) ? ' изменена!' : ' добавлена!'), false);
                            stationary_commands.add(args[0], com);
                        }
                        else {
                            //var response = vk.api.photos.getById({photos:msg.attach.photo.map((x) => x.get).join(',')}).then((response) => console.log(response));
                            command_queue.push({author: sender, key: args[0]});
                            sendMessage('Команда ' + args[0] + ' ждет назначения следующим сообщением автора', false);
                            //console.log(com);
                        }

                    }
                }

                if (command == 'delcom') {
                    if (checkMinArgsNumber(args, 1)) {
                        if (stationary_commands.has(args[0])) {
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

if (process.platform === "win32") {
    var rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on("SIGINT", function () {
        process.emit("SIGINT");
    });
}

process.on("SIGINT", function () {
    disableAllPics();
    saveFiles();
    process.exit();
});