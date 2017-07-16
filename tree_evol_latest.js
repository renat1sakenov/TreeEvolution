"use strict"

var tree_evol = (function(){

    var canvas = document.getElementById('canvas');
    canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;
    
    var ctx = canvas.getContext("2d");
    ctx.lineWidth = 0;
    
    var background = "#91E6F2"
    var COLOR_TREE_NORMAL = "#4F9E44";
    var COLOR_TREE_SICK = "#8F9E44";
    var COLOR_TREE_VERY_SICK = "#98AA44";
    var COLOR_TREE_ALMOST_DEAD = "#989922";
    var COLOR_TREE_DEAD = "#885544";
    
    var round_counter = 0;
    var bottom_x = 0;
    var bottom_y = canvas.height;
    var X_OFFSET = 250;
    
    
    var NUMBER_TREES = 20;
    var LIMIT_TREES = 300;
    var trees = [];
    
    //TEST
    var earth = Array.apply(null,Array(canvas.width)).map(function(a,b){return false;});
    //TEST_END
    
    var START_COLON = "637";
    var DNA_LENGTH_PARA = 12;
    var DNA_MIN_LENGTH = 100;
    var DNA_BRANCH_LENGTH = 13;
    
    var START_LENGTH_ATTR = 3;
    var END_LENGTH_ATTR = 5;
    var START_LEAF_ATTR = 5;
    var END_LEAF_ATTR = 6;
    var START_ANGLE_ATTR = 6;
    var END_ANGLE_ATTR = 9;
    var START_LS_ATTR = 9;
    var END_LS_ATTR = 10;
    var START_POSB_ATTR = 10;
    var END_POSB_ATTR = 12;
    var START_LEAF_EFF = 12;
    var END_LEAF_EFF = 13;
    
    var LEAF_QM = 4;
    
    //to draw the trees higher
    var DRAWING_SCALE_Y = 3;
    var LEAF_SIZE_DRAW_SCALE = 5;
    
    var thread;
    var SKIP_FRAMES  = 10;

    var TREE_STATE = {
        CREATED : "CREATED",
        IN_GROWTH : "IN_GROWTH",
        FULL_GROWN : "FULL_GROWN",
        DEAD : "DEAD"
    };
    
    
    function Stats(){
        this.average_height = 0.0;
        this.average_num_leafs = 0.0;
        
        this.average_egc = 0.0;
        this.average_cost = 0.0;
        
        
        this.calc = function(tree){
            
            var egc = tree.get_earned_growth();
            var cost = tree.get_cost();
            
            this.average_height += tree.get_height(); 
            this.average_num_leafs += tree.get_all_leafs().length;
            
            if(isNaN(egc))
                this.average_egc += 0;
            else this.average_egc += egc;
            
            if(isNaN(cost))
                this.average_cost += 0;
            else this.average_cost += cost;
        }
        
        this.div = function(l){
            this.average_height /= l;
            this.average_num_leafs /= l;
            this.average_egc /= l;
            this.average_cost /= l;
        }
    };
    
    
    //diagrams for stats
    var stats_list = [];
    var STATS_LIST_LIMIT = 100;
    var STAT_FREQUENCY = 50;
    var DIAGRAM_AVG_HEIGHT_TL_X = 0.75;
    var DIAGRAM_AVG_HEIGHT_TL_Y = 0.2;
    var DIAGRAM_AVG_LEAF_TL_X = 0.9;
    var DIAGRAM_AVG_LEAF_TL_Y = 0.2;
    var DIAGRAM_AVG_REP_TL_X = 0.6;
    var DIAGRAM_AVG_REP_TL_Y = 0.2;
    var DIAGRAM_LEN = canvas.width * 0.1 - 10;
    
    //controls on top of page
    var print_stats_b;
    var PRINT_STATS_CLICKED = true;
    
    var random_start_b;
    var RANDOM_START_CLICKED = true;
    
    var start_b;
    
    var mutation_b;
    var MUCH_MUTATION = false;
    
    //TEST
    var MIN_RAD_TO_TREE = 3;
    //TEST_END
    
    set_up_controls();
   
    

    //branch object
    function Branch(dna,parent){
        
        this.length;
        this.leaf;
        this.leaf_size = -1;
        this.angle;
        this.position_on_superbranch;
        this.parent = parent;
        this.grown = false;
        this.leaf_eff;
    
        this.create = function(dna_junk){    
            
            this.length = parseInt(dna_junk.slice(START_LENGTH_ATTR,END_LENGTH_ATTR));
            
            if(parseInt(dna_junk.slice(START_LEAF_ATTR,END_LEAF_ATTR)) > LEAF_QM)
                this.leaf = true;
            else this.leaf = false;
            
            if(this.leaf)
                this.leaf_size = parseInt(dna_junk.slice(START_LS_ATTR,END_LS_ATTR));
            
            this.angle = parseInt(dna_junk.slice(START_ANGLE_ATTR,END_ANGLE_ATTR));
            
            this.angle = this.angle % 360;

            this.position_on_superbranch = parseFloat(parseInt(dna_junk.slice(START_POSB_ATTR,END_POSB_ATTR))/100);
            
            this.leaf_eff = parseInt(dna_junk.slice(START_LEAF_EFF,END_LEAF_EFF));
            if(this.parent === null)
                this.position_on_superbranch = 1.0;   
        }       
        this.create(dna);       
    };
    
    
    //Leaf object
    function Leaf(x,y,s,e){
        this.x = x;
        this.y = y;
        this.s = s;
        this.leaf_eff = e;
    }
    

    //Tree object
    function Tree(dna,x,gen){
        
        this.branches = [];
        this.root;
        this.dna = dna;
        this.x = x;
        this.state;
        this.saved_ressources = 0;
        this.gen = gen;
        
        this.reproduction_cost = 2000;
        
        this.ROUNDS_UNTIL_DEAD = 100;
        
        this.ROUNDS_UNTIL_GROWTH = 10;
        
        this.life_points = 100;
    
        this.mutation_rate;
        
        
        this.create = function(){
            
            this.read_tree_data();

            var dna_junk = this.dna.slice(0,DNA_BRANCH_LENGTH);
            var rest = this.dna.slice(DNA_BRANCH_LENGTH);
            
            this.root = new Branch(dna_junk,null);

            var index = rest.indexOf(START_COLON);
            while(index !== -1 && rest.length >= DNA_BRANCH_LENGTH){
                var dna_snippet = rest.slice(index,DNA_BRANCH_LENGTH+index);
                var b = new Branch(dna_snippet,this.root);
                this.branches.push(b);
                rest = rest.slice(DNA_BRANCH_LENGTH+index);
                index = rest.indexOf(START_COLON);
            }    
            this.state = TREE_STATE.CREATED;
        }
        
        this.get_all_leafs = function(){
            
            var list = this.get_end_draw_points(true);
            var leaf_list = [];
            
            for(var i = 0; i < list.length; i ++){
                if(list[i].s !== -1)
                    leaf_list.push(list[i]);
            }
            return leaf_list; 
        }
        
        this.read_tree_data = function(){
            
            this.mutation_rate = parseInt(this.dna.charAt(this.dna.length-1));
            
            if(this.mutation_rate == 0)
                this.mutation_rate = 2;
            
            if(MUCH_MUTATION)
                this.mutation_rate * 3;
            
        }
        
                
        //returns a list of all start-points of branches as leaf objects
        //if 'grown_branches' is true, then only the start-points of grown branches are returned
        this.get_start_draw_points = function(grown_branches){
            
            var list = [];
            
            //root
            var x = this.x;
            var y = 0;
            var l = new Leaf(x,y,-1,-1);
            
            
            if(grown_branches){
                if(this.root.grown)
                    list.push(l);
            }else list.push(l);
            
            //branches
            for(var i = 0; i < this.branches.length; i ++){
                var x = this.x + this.root.length * this.branches[i].position_on_superbranch * Math.cos(this.root.angle * Math.PI / 180);
                var y = this.root.length * this.branches[i].position_on_superbranch * Math.sin(this.root.angle * Math.PI / 180);
                var l = new Leaf(x,y,-1,-1);

                if(grown_branches){
                    if(this.branches[i].grown)
                        list.push(l);  
                }else list.push(l); 
            }
            return list;
        }
        
        
        //returns a list of all end-points of branches as leaf objects
        //if 'grown_branches' is true, then only the end-points of grown branches are returned
        this.get_end_draw_points = function(grown_branches){
            
            var list = [];
            
            //root
            var x = this.x + this.root.length * Math.cos(this.root.angle * Math.PI / 180);
            var y = this.root.length * Math.sin(this.root.angle * Math.PI / 180);
            var l = new Leaf(x,y,this.root.leaf_size,this.root.leaf_eff);
            
            if(grown_branches){
                if(this.root.grown)
                    list.push(l);
            }else list.push(l);
            
            //branches
            for(var i = 0; i < this.branches.length; i ++){
                var x =
                    this.x + 
                    this.root.length * this.branches[i].position_on_superbranch * Math.cos(this.root.angle * Math.PI / 180) +
                    this.branches[i].length * Math.cos(this.branches[i].angle * Math.PI / 180);
                var y =
                    this.root.length * this.branches[i].position_on_superbranch * Math.sin(this.root.angle * Math.PI / 180) + 
                    this.branches[i].length * Math.sin(this.branches[i].angle * Math.PI / 180);
                var s = this.branches[i].leaf_size;
                var e = this.branches[i].leaf_eff;
                var l = new Leaf(x,y,s,e);
                
                if(grown_branches){
                    if(this.branches[i].grown)
                        list.push(l);  
                }else list.push(l);
            }
            return list;
        }
                
        this.get_height = function(){
            
            var eps = this.get_end_draw_points(true);
            var y = null;
            if(eps && eps.length > 0) 
                y = (eps.sort(function(a,b){if(a.y > b.y)return -1;if(a.y < b.y)return 1;return 0;})[0].y);            
            return y;
        }
        
        this.get_cost = function(){
            
            var cost = this.root.length;
            for(var i = 0; i < this.branches.length; i ++){
                if(this.branches[i].grown)
                    cost += this.branches[i].length;
            }
            return cost;
        }
        
        
        this.get_earned_growth = function(){
            
            var leafs = this.get_all_leafs();
            var eg_capacity = 0; 
            
            for(var i = 0; i < leafs.length; i ++){ 
                if(!check_leaf_shadow(leafs[i])&& leafs[i].y > 0 ){
                    eg_capacity += leafs[i].s * leafs[i].leaf_eff;
                }
            }
            return eg_capacity;
        }
        
        
        this.reproduce = function(){
            
            this.saved_ressources = 0;
            
            if(trees.length < LIMIT_TREES){
                var m_dna = this.dna;
                //0- 9 mutations in the genom
                for(var i = 0; i < this.mutation_rate; i ++){
                    m_dna = mutate_dna(m_dna);
                }

                var x = Math.floor(Math.random() * 200);

                if(Math.random() > 0.5)
                    x *= -1;

                if(x + this.x < 0 || x + this.x > canvas.width)
                    x *= -1;
                
                //TEST
                
                var b = true;
                
                for(var i = 0; i < MIN_RAD_TO_TREE; i++){
                    if(earth[this.x + x-i] === true || earth[this.x + x + i] === true)
                        b = false;
                }
                
                
                if(b){
                
                //TEST_END
                    trees.push(new Tree(m_dna,this.x + x,this.gen+1));
                //TEST
                
                    earth[this.x+x] = true;
                }
                
                //TEST_END
            }
            
        }
        
        
        //main function for a tree
        this.act = function(){
            
            var earned_cap;
            var min_cap;
            var full_grown = true;
            
            switch(this.state){
                
                case TREE_STATE.CREATED:
                    
                    if(this.root.angle > 180)
                        this.state = TREE_STATE.DEAD;
                    
                    if(this.ROUNDS_UNTIL_GROWTH > 0)
                        this.ROUNDS_UNTIL_GROWTH--;
                    else{
                        this.state = TREE_STATE.IN_GROWTH;
                        this.root.grown = true;
                    } 
                    break;
                    
                    
                case TREE_STATE.IN_GROWTH:
                    
                    earned_cap = this.get_earned_growth();
                    min_cap = this.get_cost();
                    var can_grow = false;
                    if(earned_cap >= min_cap)
                        can_grow = true;
                    else this.life_points -= (min_cap - earned_cap);
                    if(can_grow){
                        for(var i = 0; i < this.branches.length; i ++){
                            if(!this.branches[i].grown){
                                this.branches[i].grown = true;
                                full_grown = false;
                                break;
                            }
                        }
                    }else full_grown = false;
                
                    if(full_grown){
                        this.state = TREE_STATE.FULL_GROWN;
                    }
                    
                    if(this.life_points <= 0){
                        this.state = TREE_STATE.DEAD;
                    }

                    break;
                    
                case TREE_STATE.FULL_GROWN:      
                    
                    var cost = this.get_cost();
                    
                    var balance = this.get_earned_growth() - cost;
                    if(balance < 0)
                        this.life_points += balance;
                    else this.saved_ressources += balance;
                    
                    if(this.life_points <= 0 || this.ROUNDS_UNTIL_DEAD == 0)
                        this.state = TREE_STATE.DEAD;
      
                    if(this.saved_ressources >= this.reproduction_cost)
                        this.reproduce();
                                     
                    this.ROUNDS_UNTIL_DEAD--;
                    
                    break;
                
                    
                case TREE_STATE.DEAD:

                    this.root.grown = false;
                    for(var i = 0; i < this.branches.length; i ++){
                        this.branches[i].grown = false;
                    }                    
                    
                    var me = trees.indexOf(this);
                    trees.splice(me,1);
                    
                    //TEST
                    earth[this.x] = false;
                    //TEST_END
                    
                    break;                    
            }
            
            
        }

        this.create();
    };
    
    

    function generate_dna(){
        
        var g_dna = START_COLON;
        var num;
        
        for(var i = 0; i < DNA_LENGTH_PARA; i ++){
            num = Math.random() * Math.pow(10,10);
            num.toFixed(0);
            g_dna += num;
        }
        
        while(g_dna.indexOf(".") !== -1)
            g_dna = g_dna.replace(".","");
        
        return g_dna;  
    }
    
    //change one number
    function mutate_dna(dna){
        
        var change = Math.floor(Math.random() * (9 - 1));
        var rand = Math.floor(Math.random() * ((dna.length-1) - START_COLON.length + 1)) + START_COLON.length;
        dna = dna.substr(0,rand) + change + dna.substr(rand+1);
        return dna;
    }
    
    
    
    function check_same_leaf(leaf,leaf2){
        
        return leaf.x == leaf2.x && leaf.y == leaf2.y && leaf.s == leaf2.s && leaf.leaf_eff == leaf2.leaf_eff;  
    }
    
    function check_leaf_shadow(leaf){
    
        var x = leaf.x;
        var y = leaf.y
        var rad = leaf.s + LEAF_SIZE_DRAW_SCALE;
        var ep, sp = [];
        
        for(var i = 0; i < trees.length; i ++){
            
            ep = trees[i].get_end_draw_points(true);
            sp = trees[i].get_start_draw_points(true);
            
            for(var j = 0; j < sp.length; j ++){
                
                var m = (sp[j].y - ep[j].y)/(sp[j].x - ep[j].x);
                var b = sp[j].y - (m * sp[j].x);
                
                if(sp[j].x < ep[j].x){          //if branch is leaning right.
                    if(x > sp[j].x && x < ep[j].x && (y <= m*x + b) && !check_same_leaf(leaf,ep[j]))
                        return true;       
                }else if(sp[j].x > ep[j].x){    //if branch is leaning left.    
                    if(x < sp[j].x && x > ep[j].x && (y <= m*x + b) && !check_same_leaf(leaf,ep[j]))
                        return true;     
                }else{                          //branch grew straight upwards
                     if(y < ep[j].y && x <= ep[j].x && x >= ep[j].x && !check_same_leaf(leaf,ep[j]))
                         return true;
                }
            }
            
        }
        return false;
    }
    
    
    function draw_trees(){
        
        ctx.fillStyle = background;
        ctx.fillRect(0,0,canvas.width,canvas.height);
    
        var sp, ep, ll = [];
        
        for(var i = 0; i < trees.length; i ++){
            
            sp = trees[i].get_start_draw_points(true);
            ep = trees[i].get_end_draw_points(true);
            ll = trees[i].get_all_leafs();
            
            for(var j = 0; j < sp.length; j ++){
                ctx.moveTo(sp[j].x,bottom_y-sp[j].y * DRAWING_SCALE_Y);
                ctx.lineTo(ep[j].x,bottom_y-ep[j].y * DRAWING_SCALE_Y);
                ctx.stroke();
            }        
    
            if(trees[i].life_points >= 90)
                ctx.fillStyle=COLOR_TREE_NORMAL;
            else if(trees[i].life_points >= 70)
                ctx.fillStyle = COLOR_TREE_SICK;
            else if(trees[i].life_points >= 50)
                ctx.fillStyle = COLOR_TREE_VERY_SICK;
            else if(trees[i].life_points >= 30)
                ctx.fillStyle = COLOR_TREE_ALMOST_DEAD;
            else if(trees[i].life_points >= 0)
                ctx.fillStyle = COLOR_TREE_DEAD;

            for(var k = 0; k < ll.length; k ++){
                ctx.beginPath();
                ctx.arc(ll[k].x,bottom_y-ll[k].y * DRAWING_SCALE_Y,ll[k].s + LEAF_SIZE_DRAW_SCALE,0,2*Math.PI);
                ctx.closePath();
                ctx.fill();
            }     
        }
    }
    
    
    function draw_stats(){
        
        
        //x-axis height
        ctx.moveTo(canvas.width * DIAGRAM_AVG_HEIGHT_TL_X,canvas.height * DIAGRAM_AVG_HEIGHT_TL_Y);
        ctx.lineTo(canvas.width * DIAGRAM_AVG_HEIGHT_TL_X + DIAGRAM_LEN, canvas.height * DIAGRAM_AVG_LEAF_TL_Y);
        ctx.stroke();
        
        //y-axis
        ctx.moveTo(canvas.width * DIAGRAM_AVG_HEIGHT_TL_X,canvas.height * DIAGRAM_AVG_HEIGHT_TL_Y);
        ctx.lineTo(canvas.width * DIAGRAM_AVG_HEIGHT_TL_X,10);
        ctx.stroke();
        
        ctx.fillStyle = "black";
        ctx.fillText("Height:" ,canvas.width * DIAGRAM_AVG_HEIGHT_TL_X + 40,10);
        ctx.fillText("0 m",canvas.width * DIAGRAM_AVG_HEIGHT_TL_X,canvas.height * DIAGRAM_AVG_HEIGHT_TL_Y + 10);
        ctx.fillText("70 m",canvas.width * DIAGRAM_AVG_HEIGHT_TL_X,10);
        
        
        //x-axis leaf
        ctx.moveTo(canvas.width * DIAGRAM_AVG_LEAF_TL_X,canvas.height * DIAGRAM_AVG_LEAF_TL_Y);
        ctx.lineTo(canvas.width -10, canvas.height * DIAGRAM_AVG_LEAF_TL_Y);
        ctx.stroke();
        
        //y-axis 
        ctx.moveTo(canvas.width * DIAGRAM_AVG_LEAF_TL_X,canvas.height * DIAGRAM_AVG_LEAF_TL_Y);
        ctx.lineTo(canvas.width * DIAGRAM_AVG_LEAF_TL_X, 10);
        
        ctx.fillText("Leafs:", canvas.width * DIAGRAM_AVG_LEAF_TL_X + 40, 10);
        ctx.fillText("0",canvas.width * DIAGRAM_AVG_LEAF_TL_X,canvas.height * DIAGRAM_AVG_LEAF_TL_Y + 10);
        ctx.fillText("4",canvas.width * DIAGRAM_AVG_LEAF_TL_X,10);
        
        
        //x-axis egc
        ctx.moveTo(canvas.width * DIAGRAM_AVG_REP_TL_X, canvas.height * DIAGRAM_AVG_REP_TL_Y);
        ctx.lineTo(canvas.width * DIAGRAM_AVG_REP_TL_X + DIAGRAM_LEN, canvas.height * DIAGRAM_AVG_REP_TL_Y);
        ctx.stroke();
        
        ctx.moveTo(canvas.width * DIAGRAM_AVG_REP_TL_X, canvas.height * DIAGRAM_AVG_REP_TL_Y);
        ctx.lineTo(canvas.width * DIAGRAM_AVG_REP_TL_X, 10);
        ctx.stroke();
        
        ctx.fillText("Ressources for Reproduction:", canvas.width * DIAGRAM_AVG_REP_TL_X + 40,10);
        ctx.fillText("0",canvas.width * DIAGRAM_AVG_REP_TL_X,canvas.height * DIAGRAM_AVG_REP_TL_Y + 10);
        ctx.fillText("150",canvas.width * DIAGRAM_AVG_REP_TL_X, 10);
        
        
        var delta = DIAGRAM_LEN / stats_list.length;

        var x,y,y2,xp1;
        
        for(var i = 0; i < stats_list.length-1;  i++){
            
            x = delta * i;
            xp1 = delta * (i+1);            
            
            //diagram height: 0 - 70;
            //0 -> canvas.height * DIAGRAM_AVG_HEIGHT_TL_Y
            //70 -> 10
            y =  (-canvas.height*DIAGRAM_AVG_HEIGHT_TL_Y + 10)*(stats_list[i].average_height/70);
            y2 =  (-canvas.height*DIAGRAM_AVG_HEIGHT_TL_Y + 10)*(stats_list[i+1].average_height/70);           
            
            //height
            ctx.moveTo(x + canvas.width * DIAGRAM_AVG_HEIGHT_TL_X, y + canvas.height * DIAGRAM_AVG_HEIGHT_TL_Y);
            ctx.lineTo(xp1 + canvas.width * DIAGRAM_AVG_HEIGHT_TL_X,y2 + canvas.height * DIAGRAM_AVG_HEIGHT_TL_Y);
            ctx.stroke();
            
            
            //0 - 4
            //0 -> canvas.height * DIAGRAM_AVG_LEAF_TL_Y
            //4 -> 10
            y = (-canvas.height*DIAGRAM_AVG_LEAF_TL_Y + 10)*(stats_list[i].average_num_leafs/4);
            y2 = (-canvas.height*DIAGRAM_AVG_LEAF_TL_Y + 10)*(stats_list[i+1].average_num_leafs/4);
            
            //leaf
            ctx.moveTo(x + canvas.width * DIAGRAM_AVG_LEAF_TL_X, y + canvas.height * DIAGRAM_AVG_LEAF_TL_Y);
            ctx.lineTo(xp1 + canvas.width * DIAGRAM_AVG_LEAF_TL_X,y2 + canvas.height * DIAGRAM_AVG_LEAF_TL_Y);
            ctx.stroke();
            
            y = (-canvas.height*DIAGRAM_AVG_REP_TL_Y + 10)*((stats_list[i].average_egc-  stats_list[i].average_cost)/150);
            y2 = (-canvas.height*DIAGRAM_AVG_REP_TL_Y + 10)*((stats_list[i+1].average_egc - stats_list[i+1].average_cost)/150);
            
            //egc
            if(y < canvas.height*DIAGRAM_AVG_REP_TL_Y || y2 < canvas.height*DIAGRAM_AVG_REP_TL_Y){
                ctx.moveTo(x + canvas.width * DIAGRAM_AVG_REP_TL_X, y + canvas.height * DIAGRAM_AVG_REP_TL_Y);
                ctx.lineTo(xp1 + canvas.width * DIAGRAM_AVG_REP_TL_X, y2 + canvas.height * DIAGRAM_AVG_REP_TL_Y);
                ctx.stroke();
            }
            
            
        }
        
        
    }

    
    function set_up(){
        trees = [];
        stats_list = [];
        if(RANDOM_START_CLICKED){
            var test = "63730909099999999000000000000637109030999999999999999990000002"; //"637309090999999990000000000630109030999999999999999990000002";           
            trees.push(new Tree(test,120 + X_OFFSET));
        }else{  
            for(var i = 0; i < NUMBER_TREES; i ++){
                var t = new Tree(generate_dna(),Math.floor(X_OFFSET + Math.random() * 900),0);
                trees.push(t);
            }
        }
        run();
    }
    
    function set_up_controls(){
        
        print_stats_b = document.createElement("a");
        print_stats_b.id = "print_stats_b";
        print_stats_b.innerHTML = "don't print stats";
        print_stats_b.onclick = print_stats_click;
        print_stats_b.style.position = "absolute";
        print_stats_b.style.left = "0%";
        print_stats_b.style.top = "0%";
        print_stats_b.style.zIndex = 1;
        print_stats_b.style.color = "black";
        
        document.body.appendChild(print_stats_b);

        random_start_b = document.createElement("a");
        random_start_b.id = "random_start_b";
        random_start_b.innerHTML = "random spawn";
        random_start_b.onclick = start_spawn;
        random_start_b.style.position = "absolute";
        random_start_b.style.left = "7%";
        random_start_b.style.top = "0%";
        random_start_b.style.zIndex = 1;
        random_start_b.style.color = "black";
        
        document.body.appendChild(random_start_b);
        
        mutation_b = document.createElement("a");
        mutation_b.id = "mutation_b";
        mutation_b.innerHTML = "more mutation";
        mutation_b.onclick = mutation_click;
        mutation_b.style.position = "absolute";
        mutation_b.style.left ="14%";
        mutation_b.style.top = "0%";
        mutation_b.style.zIndex = 1;
        mutation_b.style.color = "black";
        
        document.body.appendChild(mutation_b);
        
        start_b = document.createElement("a");
        start_b.id="start_b";
        start_b.innerHTML = "start";
        start_b.onclick = set_up;
        start_b.style.position = "absolute";
        start_b.style.left = "21%";
        start_b.style.top = "0%";
        start_b.style.zIndex = 1;
        start_b.style.color = "black";
        
        document.body.appendChild(start_b);
        
    }
    
    function mutation_click(){
        if(MUCH_MUTATION){
            mutation_b.innerHTML = "more mutation";
        
        }else{
            mutation_b.innerHTML = "less mutation";
            
        }
        MUCH_MUTATION = !MUCH_MUTATION;
    }
    
    function start_spawn(){
        if(RANDOM_START_CLICKED){
            random_start_b.innerHTML = "standard spawn";
        }else{
            random_start_b.innerHTML = "random spawn";
        }
        RANDOM_START_CLICKED = !RANDOM_START_CLICKED;
    }
    
    function print_stats_click(){
       if(PRINT_STATS_CLICKED){
           print_stats_b.innerHTML = "print stats";
       }else{
           print_stats_b.innerHTML = "don't print stats";
       }   
        PRINT_STATS_CLICKED  = !PRINT_STATS_CLICKED;        
    }
    
    function console_log(stat){
        console.log("Generation: " + trees[0].gen);
        console.log("Round: "+round_counter);
        console.log("Number Trees:"+trees.length);
        
        console.log("Average height: " + stat.average_height);
        console.log("Average number of leafs per tree: " + stat.average_num_leafs);
        console.log("Average EGC: " + stat.average_egc);
        console.log("Average Cost :" + stat.average_cost);
    }
    

    //main loop
    function run(){
        
        var stat = new Stats();
        
        for(var i = 0; i < trees.length; i ++){
            stat.calc(trees[i]);
            trees[i].act();
        }
        
        stat.div(trees.length);
        if(round_counter % STAT_FREQUENCY == 0)
            stats_list.push(stat);    
        if(stats_list.length >= STATS_LIST_LIMIT)
            stats_list.splice(0,1);
                    
    

       // if(round_counter % SKIP_FRAMES == 0){
            draw_trees();
            if(PRINT_STATS_CLICKED)
                draw_stats();
       // }
        round_counter ++;
        
        console_log(stat);
        
        thread = setTimeout(run,50);
    }
})();