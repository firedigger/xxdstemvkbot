const request = require("request");
const fs = require('fs');
const vk = new (require('vk-io'));
const SerializableMap = require('./SerializableMap');
const SerializableSet = require('./SerializableSet');

const commands_filename = 'commands.txt';
const bayan_filename = 'bayans.txt';
const ignore_list_filename = 'ignore_list.txt';

var stationary_commands = new SerializableMap();
var bayan_checker = new SerializableSet();
var ignore_list = new SerializableSet();

function initializeStructure(structure,filename, initializerList)
{
    if (fs.existsSync(filename))
    {
        structure.load_from_file(filename);
    }
    else
    {
        structure.initializeFromArray(initializerList);
    }
}

initializeStructure(stationary_commands, commands_filename, [['digger','уебок!'],['xxdstem','красава!']]);
initializeStructure(bayan_checker, bayan_filename, []);
initializeStructure(ignore_list, ignore_list_filename, ["penis","dick","milf","onetruerem","rem_(re_zero)","porn","cock","porno","pornstars","blowjob"]);

const defaultSubreddit =  ["pantsu","awwnime","ecchi"];
const dicker = ["photo9680305_360353548","photo9680305_373629840","photo9680305_356010821","photo9680305_340526271","photo9680305_324159352","photo9680305_248221743","photo297755100_438730139"];
const xxdstem_id = 314301750;
const digger_id = 9680305;
const max_counter = 10;

function getRandomInt(min, max)
{
    return Math.floor(Math.random() * (max - min)) + min;
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

function parseRedditPic(str, index)
{
    var parsed_body = JSON.parse(str)['data']['children'][index]['data'];
    var pic = parsed_body['preview']['images'][0]['source']['url'];
    var redd = parsed_body['permalink'];
    return {pic:pic,redd:redd};
}

var config = JSON.parse(fs.readFileSync('config.json'));


vk.setToken(config.token);

vk.longpoll().then(() => {
        console.log('Longpoll запущен!');
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

function generateRequestString(msg)
{
    return 'REQUEST: ' + msg.text + '\n';
}

vk.on('message',(msg) =>
{
    var msgtext = "";

    if(msg.text != null)
        msgtext = msg.text.toLowerCase();

    var sender = msg.user;

    function sendVkPic(picLink,message)
    {
        vk.upload.message({
            file: picLink
        }).then(function(data) {
            var pik_id = data['owner_id']+"_"+data['id'];
            return msg.send(message,{ attach: "photo"+pik_id, fwd:false});
        });
    }

    function sendMessage(message)
    {
        return msg.send(message,{fwd:false});
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
                if (i > max_counter)
                    break;
            }
            if (i > max_counter)
                sendMessage(request_str + 'Забаянился');
            else
                contentSender(answer);
        }
        catch (err)
        {
            sendMessage(request_str + "хуйня какая-та!");
        }
    }

    function checkMinArgsNumber(args, min)
    {
        if (args.length < min)
        {
            sendMessage(request_str + 'Нужно минимум ' + min + ' аргументов!');
            return false;
        }
        return true;
    }

    function check_stationary_command(message)
    {
        stationary_commands.forEach(function (value,key)
        {
            if (message == key)
                sendMessage(value);
        });
    }

    function checkIgnore(arg)
    {
        if (ignore_list.has(arg))
            sendMessage(request_str + "Эта хуйня в игноре!");
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
            return bayan_checker.add_hash_and_check(answer);
        });
    }

    if (msgtext.startsWith('!'))
    {
        var words = msgtext.split(' ');
        var command = words[0].slice(1);
        var args = words.slice(1);

        //console.log(command);

        var request_str = generateRequestString(msg);


        if (command == 'yan')
        {
            if (checkMinArgsNumber(args,1))
            {
                if (checkIgnore(args[0]))
                {
                    if (args[0] == 'digger' || args[0] == 'dicker' || args[0] == 'диккер')
                    {
                        sendVkPic(randomArrayElement(dicker), request_str + "ееее диккер!");
                    }
                    else
                    {
                        request.get("https://yande.re/post?tags=" + args[0], function (err, res, body)
                        {
                            if (body.indexOf('Nobody here but us chickens!') != -1)
                            {
                                request.get("https://yande.re/tag?name=" + args[0] + "&type=&order=count", function (err, res, body)
                                {
                                    //console.log(body);
                                    var elem_exp = /<td align="right">[^]*?>\?<\/a>/g;

                                    var count_exp = '<td align="right">.*?</td>';
                                    var title_exp = /title=.*?>/i;

                                    var matches = body.match(elem_exp);

                                    //console.log(matches);

                                    var counts = [];
                                    var sum = 0;
                                    var titles = [];

                                    matches.forEach(function (elem)
                                    {
                                        //console.log(elem);
                                        var count = (+elem.match(new RegExp(count_exp)).toString().slice(6,-2));
                                        var title = elem.match(new RegExp(title_exp)).toString().slice(6,-2);

                                        counts.push(count);
                                        titles.push(title);
                                        sum+=count;

                                    });

                                    //console.log(titles);

                                    var v = getRandomInt(0,sum);

                                    var c = 0;
                                    var i = 0;
                                    while (c < v)
                                    {
                                        c+=counts[i];
                                        i++;
                                    }

                                    args[0] = titles[i];

                                    request_str+= ' fixed to ' + args[0] + '\n';

                                    request.get("https://yande.re/post?tags=" + args[0], function (err, res, body)
                                    {
                                        processYandereRequest(body);
                                    });
                                });
                            }
                            else
                            {
                                processYandereRequest(body);
                            }
                        });
                    }
                }
            }
        }

        if (command == 'pic' || command == 'пик')
        {
            if (args.length == 0)
            {
                args = [randomArrayElement(defaultSubreddit)];
            }
            if (checkIgnore(args[0]))
            {
                request.get("https://www.reddit.com/r/"+args[0]+"/new/.json", function(err,res,body)
                {
                    processContent(function () {
                        return parseRedditPic(body,getRandomInt(0,25));
                    },function (answer) {
                        sendVkPic(answer.pic,request_str + "https://www.reddit.com"+answer.redd);
                    },function (answer) {
                        return bayan_checker.add_hash_and_check(answer.pic);
                    });
                });
            }
        }

        if (command == 'bash')
        {
            request.get('http://bohdash.com/random/bash/random.php', function(err,res,body)
            {
                processContent(function () {
                    return parseBashQuote(body);
                },function (answer) {
                    sendMessage(request_str + answer);
                },function (answer) {
                    return bayan_checker.add_hash_and_check(answer);
                });
            });
        }

        if (command == 'news')
        {
            request.get('https://yandex.ru', function(err,res,body)
            {
                processContent(function () {
                    return parseYandexNews(body);
                },function (answer) {
                    sendMessage(request_str + answer);
                },function (answer) {
                    return bayan_checker.add_hash_and_check(answer);
                });
            });
        }

        check_stationary_command(command);

        if (command == 'ignore_list')
        {
            sendMessage(request_str + 'Ignored list: ' + ignore_list.showValues());
        }

        if (sender == xxdstem_id || sender == digger_id) {

            if (command == 'clear_history')
            {
                sendMessage('Баяны очищены!');
                bayan_checker.clear();
            }

            if (command == 'ignore_add')
            {
                if (checkMinArgsNumber(args, 1)) {
                    ignore_list.add(args[0]);
                    sendMessage('Добавлен игнор ' + args[0]);
                }
            }

            if (command == 'ignore_del')
            {
                if (checkMinArgsNumber(args, 1)) {
                    ignore_list.add(args[0]);
                    sendMessage('Удален игнор ' + args[0]);
                }
            }

            if (command == 'addcom') {
                if (checkMinArgsNumber(args, 2)) {
                    stationary_commands.add(args[0], args.slice(1).join(' '));
                    sendMessage('Добавлена команда ' + args[0]);
                }

                stationary_commands.save_to_file(commands_filename);
            }

            if (command == 'delcom') {
                if (checkMinArgsNumber(args, 1)) {
                    stationary_commands.delete(args[0]);
                    sendMessage('Удалена команда ' + args[0]);
                }

                stationary_commands.save_to_file(commands_filename);
            }
        }

    }
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
    stationary_commands.save_to_file(commands_filename);
    bayan_checker.save_to_file(bayan_filename);
    ignore_list.save_to_file(ignore_list_filename);
    process.exit();
});