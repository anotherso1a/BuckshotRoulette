const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 混洗数组
 */
function shuffle(arr) {
  let i = arr.length;
  while (i--) {
    const ri = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[ri]] = [arr[ri], arr[i]];
  }
  return arr;
}

/**
 * 根据真子弹和空包弹的数量，创建子弹数组
 * @param {number} trueNum 真子弹
 * @param {number} fakeNum 空包弹
 * @returns 子弹数组
 */
function createBullets(trueNum, fakeNum) {
  return Array.from({ length: trueNum }, () => new Bullet(false)).concat(Array.from({ length: fakeNum }, () => new Bullet(true)));
}

class Bullet {
  constructor(isFake) {
    this.isFake = isFake
  }
}

class Gun {
  constructor(bullets) {
    this.bullets = bullets;
    shuffle(this.bullets);
  }
  fire() {
    if (this.bullets.length === 0) {
      return false;
    }
    return this.bullets.pop();
  }
}

class Player {
  constructor(name = 'tester', hp = 2) {
    this.name = name;
    this.isAlive = true;
    this.hp = hp;
    this.maxHp = hp;
    this.items = [];
  }
  recover() {
    this.hp += 1;
    if (this.hp > this.maxHp) {
      this.hp = this.maxHp;
    }
  }
  getItems(num) {
    this.items = this.items.concat(Array.from({ length: num }, () => {
      const Item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
      console.log(`【${this.name}】获得了道具「${Item.name}」`);
      return new Item();
    })).slice(0, 8); // 最多8个道具
  }
}

class Computer extends Player {
  constructor(hp = 2) {
    super('computer', hp);
  }

  async makeDecision(game) {
    console.log(`【${this.name}】正在思考...\n\n`);
    await sleep(1000 * (Math.random() + 8)); // 假装思考
    const magnifierIndex = this.items.findIndex(item => item instanceof Magnifier);
    const wineIndex = this.items.findIndex(item => item instanceof Wine);
    const handcuffsIndex = this.items.findIndex(item => item instanceof Handcuffs)
    const fakeBullets = game.gun.bullets.filter(b => b.isFake).length;
    const realBullets = game.gun.bullets.length - fakeBullets;
    const isNextFake = game.__isNextFake;

    // 如果下一颗是实弹，且存在锯口刀，使用锯口刀
    if (!isNextFake) {
      const knifeIndex = this.items.findIndex(item => item instanceof Knife);
      if (knifeIndex !== -1 && !game.isDamageUp) {
        return `use ${knifeIndex + 1}`;
      } else {
        game.__isNextFake = true; // 重置
        return 'shoot opponent';
      }
    }

    // 优先使用手铐，前提是对方未被手铐铐住
    if (handcuffsIndex !== -1 && game.skipNextTrun === 0) {
      return `use ${handcuffsIndex + 1}`;
    }

    // 使用放大镜或者酒
    if (magnifierIndex !== -1) {
      return `use ${magnifierIndex + 1}`;
    }
    if (wineIndex !== -1 && fakeBullets > realBullets && Math.random() < 0.8) { // 80%的概率使用酒
      return `use ${wineIndex + 1}`;
    }

    // 评估是否向对方射击
    if (!fakeBullets) { // 没有空包弹，直接向对方射击
      return 'shoot opponent';
    }
    if (!realBullets) { // 没有实弹，直接向自己射击
      return 'shoot self';
    }
    // 有实弹，有空包弹，评估是否向对方射击
    const aggressive = realBullets / game.gun.bullets.length;
    if (aggressive > 0.5) { // 实弹占比大于50%
      // 80%的概率向对方射击
      return Math.random() < 0.8 ? 'shoot opponent' : 'shoot self';
    } else {
      // 继续评估向对方射击失败之后，对方的射击概率
      // todo 评估对方道具
      const aggressive2 = realBullets / (game.gun.bullets.length - 1);
      if (aggressive2 <= 0.5) { // 对方实弹占比小于50%，直接向对方射击
        return 'shoot opponent'
      } else {
        // 20%的概率向对方射击
        return Math.random() < 0.2 ? 'shoot opponent' : 'shoot self';
      }
    }
  }
}

class Item {
  constructor(name, showName) {
    this.name = name;
    this.showName = showName;
  }
  displayName() {
    return this.showName || this.name;
  }
}

class Magnifier extends Item {
  constructor() {
    super('magnifier', '放大镜');
  }
  display(isFake) {
    console.log(`使用「放大镜」成功，下一颗子弹是【${isFake ? '空包弹' : '真子弹'}】!`)
  }
  use(gun) {
    const isFake = gun.bullets[gun.bullets.length - 1].isFake;
    this.display(isFake);
    return isFake;
  }
}

class Knife extends Item {
  constructor() {
    super('knife', '锯口刀');
  }
  display() {
    console.log('使用「锯口刀」成功，下一颗子弹如果是真子弹，伤害+1');
  }
  use(game) {
    game.increaseDamage();
    this.display();
  }
}

class Cigarette extends Item {
  constructor() {
    super('cigarette', '香烟');
  }
  display() {
    console.log('使用「香烟」成功，回复1点生命值');
  }
  use(player) {
    player.recover();
    this.display();
  }
}

class Wine extends Item {
  constructor() {
    super('wine', '酒');
  }
  display(bullet) {
    console.log(`使用「酒」成功，退出一颗子弹，退出的子弹为：【${bullet.isFake ? '空包弹' : '真子弹'}】!`);
  }
  use(gun) {
    const bullet = gun.bullets.pop();
    this.display(bullet);
    return bullet;
  }
}

class Handcuffs extends Item {
  constructor() {
    super('handcuffs', '手铐');
  }
  display() {
    console.log('使用「手铐」成功，跳过对方一回合');
  }
  use(game) {
    game.skipTrun();
    this.display();
  }
}

const ITEMS = [Magnifier, Knife, Cigarette, Wine, Handcuffs];

const LevelMap = [
  [1, 2],
  [2, 2],
  [3, 2],
  [3, 3],
  [4, 4],
  [5, 3],
  [6, 2]
]

const DecisionMap = {
  'shoot opponent': '向对方开枪',
  'shoot self': '向自己开枪'
}

const InputMap = {
  '-1': '向自己开枪',
  '0': '向对方开枪'
}

class BuckshotRoulette {
  constructor(player, player2) {
    this.player = player;
    this.player2 = player2;
    this.isDamageUp = false;
    this.skipNextTrun = 0; // 0 无效果，1 跳过下一回合，-1 正常回合，且将 skipNextTrun 设为 0。避免连续跳过回合
    this.round = 0;
    this.currentPlayer = this.player;
    this.gun = new Gun(createBullets(...LevelMap[this.round]));
    this.__isNextFake = true;
  }
  increaseDamage() {
    this.isDamageUp = true;
  }
  skipTrun() {
    this.skipNextTrun = 1;
  }
  logStatus() {
    console.log('==========================================');
    console.log(`【${this.player.name}】 hp: ${this.player.hp} VS 【${this.player2.name}】 hp: ${this.player2.hp}`);
    console.log('==========================================');
    console.log(`剩余子弹: ${this.gun.bullets.length}`);
    console.log(`真子弹: ${this.gun.bullets.filter(bullet => !bullet.isFake).length}`);
    console.log(`空包弹: ${this.gun.bullets.filter(bullet => bullet.isFake).length}`);
    console.log('');
    console.log(`轮到【${this.currentPlayer.name}】操作`);
    console.log(`-1、向自己开枪`);
    console.log(`0、向对方开枪`);
    if (this.currentPlayer.items.length > 0) {
      console.log(`道具: \n${this.currentPlayer.items.map((item, index) => `${index + 1}、${item.displayName()}`).join('\n')}`);
    }
  }
  async start() {
    this.logStatus();
    if (this.currentPlayer.name === 'computer') { // 电脑自动操作
      const decision = await this.currentPlayer.makeDecision(this);
      console.log(`【${this.currentPlayer.name}】选择了${DecisionMap[decision] || '使用道具' + this.currentPlayer.items[parseInt(decision.split(' ')[1]) - 1].displayName()}`);
      if (decision === 'shoot opponent') {
        this.shoot(this.currentPlayer === this.player ? this.player2 : this.player);
      } else if (decision === 'shoot self') {
        this.shoot(this.currentPlayer);
      } else if (decision.startsWith('use')) {
        await sleep(1000);
        const num = parseInt(decision.split(' ')[1]);
        this.useItem(num);
      }
      return;
    }
    readline.question('请输入操作：', (input) => {
      this.handleInput(input);
    });
  }
  handleInput(input) {
    console.log('\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n');
    console.log(`${this.currentPlayer.name} 选择了 ${InputMap[input] || '使用道具' + this.currentPlayer.items[parseInt(input) - 1].displayName()}`);
    const num = parseInt(input);
    if (num === -1) {
      this.shoot(this.currentPlayer);
    } else if (num === 0) {
      this.shoot(this.currentPlayer === this.player ? this.player2 : this.player);
    } else if (num > 0 && num <= this.currentPlayer.items.length) {
      this.useItem(num);
    } else {
      console.log('输入错误，请重新输入');
      this.start();
    }
  }
  useItem(num) { // 使用道具
    const item = this.currentPlayer.items[num - 1]
    console.log(`使用道具「${item.displayName()}」`);
    let res = false;
    switch (item.name) {
      case 'magnifier':
        this.__isNextFake = item.use(this.gun);
        res = true;
        break;
      case 'wine':
        item.use(this.gun);
        res = true;
        break;
      case 'knife':
        if (this.isDamageUp) {
          console.log('已经使用过锯口刀了');
        } else {
          item.use(this);
          res = true;
        }
        break;
      case 'handcuffs':
        if (this.skipNextTrun !== 0) {
          console.log('已经使用过手铐了');
        } else {
          item.use(this);
          res = true;
        }
        break;
      case 'cigarette':
        item.use(this.currentPlayer);
        res = true;
        break;
      default:
        break;
    }
    if (res) {
      this.currentPlayer.items.splice(num - 1, 1);
    } else {
      console.log('使用失败，请重新输入');
    }
    this.nextTurn(false); // 使用道具不切换回合
  }
  async shoot(target) {
    console.log('\n\n\n\n\n砰！！！！！！！！！')
    await sleep(1000 * (Math.random() + 1));
    const bullet = this.gun.fire();
    let changeTrun = true
    if (bullet.isFake) {
      console.log(`\n\n\n\n\n${this.currentPlayer.name}打出了一颗空包弹`);
      if (target === this.currentPlayer) {
        console.log(`不错，${this.currentPlayer.name}很有胆量，继续吧！`);
        changeTrun = false;
      }
    } else {
      console.log(`\n\n\n\n\n${this.currentPlayer.name}打出了一颗真子弹`);
      target.hp -= 1;
      if (this.isDamageUp) {
        target.hp -= 1;
      }
    }
    this.isDamageUp = false;
    if (target.hp <= 0) {
      console.log(`${target.name}死亡`);
      return this.gameOver();
    }
    if (this.gun.bullets.length === 0) {
      console.log('子弹打光了');
      return this.nextRound()
    }
    this.nextTurn(changeTrun);
  }
  nextTurn(changePlayer = true) {
    if (changePlayer) {
      const expectedPlayer = this.currentPlayer === this.player ? this.player2 : this.player;
      if (this.skipNextTrun === 1) { // 只有切换回合的时候才判定
        this.skipNextTrun = -1;
        console.log(`【${expectedPlayer.name}】的手被铐住了，无法行动...`);
      } else if (this.skipNextTrun === -1) {
        this.currentPlayer = expectedPlayer;
        this.skipNextTrun = 0;
      } else {
        this.currentPlayer = expectedPlayer;
      }
    }
    this.start();
  }
  async nextRound() {
    this.round += 1;
    console.log(`\n\n第${this.round}回合开始`);
    await sleep(1000);
    const bullets = LevelMap[this.round] || LevelMap[LevelMap.length - 1];
    console.log(`\n\n本轮真子弹: ${bullets[0]}，空包弹: ${bullets[1]}`);
    await sleep(3000);
    console.log(`\n\n子弹随机装填完毕！`)
    await sleep(2000);
    this.gun = new Gun(createBullets(...bullets));
    console.log(`\n\n抽取道具中...`);
    await this.drawItem();
    console.log(`\n\n抽取道具完毕！`);
    await sleep(3000);
    this.nextTurn(false);
  }
  async drawItem() {
    await sleep(3000);
    this.player.getItems(3);
    await sleep(3000);
    this.player2.getItems(3);
  }
  gameOver() {
    console.log('游戏结束');
    const winer = this.player.hp > 0 ? this.player : this.player2;
    console.log(`${winer.name}获胜，赢取 1000000$ 奖金`);
    readline.close();
  }
}


// 道具
// 放大镜：查看下一颗子弹是真子弹还是空包弹
// 锯口刀：下一颗子弹是真子弹，伤害+1
// 香烟：回复1点生命值
// 酒：直接退出一颗子弹
// 手铐：跳过对方一回合

// 双人
// new BuckshotRoulette(new Player('玩家1', 3), new Player('玩家2', 3)).start();

// 人机
// level 1
// new BuckshotRoulette(new Player('玩家', 2), new Computer(2)).start();
// level 2
new BuckshotRoulette(new Player('玩家', 4), new Computer(4)).start();
// level 3
// new BuckshotRoulette(new Player('玩家', 6), new Computer(6)).start();
