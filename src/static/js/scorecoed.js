var tplPopup = null;
var tplScore = null;
var tplTwitter = null;
var ndx = null;
var partyChart = null;
jQuery(function($) {
    var message = "";
    $(".country").prepend("<div id='alert_placeholder'><div class='alert alert-info'><span></span><button class='close' data-dismiss='alert' aria-hidden='true'>×</button></div></div>");
    $("#alert_placeholder").hide();
    $("#search-input").keyup(function() {
        var s = $(this).val().toLowerCase();
        wall.dimension().filter(function(d) {
            return d.indexOf(s) !== -1;
        });
        $(".resetall").attr("disabled", true);
        dc.redrawAll();
        console.log($(this).val());
    });
    tplPopup = _.template($("#infobox_tpl").text());
    tplScore = _.template($("#score_tpl").text());
    tplTwitter = _.template($("#twitter_tpl").text());
    $(".resetall").click(function() {
        $("#search-input").val("");
        $(".resetall").attr("disabled", false);
        dc.filterAll();
        dc.renderAll();
    });
    $("body").on("click", ".btn", function(event) {
        ga && ga('send', 'event', 'button', 'click', $(this).text());
    });
});
if (!hasHashFilter()) {
    $.ajax({
        url: "https://freegeoip.net/json/?callback=?",
        crossDomain: true,
        type: "GET",
        contentType: "application/json; charset=utf-8;",
        async: false,
        dataType: 'jsonp',
        success: function(data) {
            ga && ga('send', 'event', 'country', 'lookup', data.country_name);
            if (!bar_country) return;
            _.each(bar_country.group().top(28), function(d) {
                if (data.country_name == d.key) {
                    location.hash = "#bar_country";
                    notice("Show only MEPs from " + d.key);
                    bar_country.filter(data.country_name);
                    scrolled = true;
                    dc.redrawAll();
                    $("#collapseOne").collapse("show");
                }
            });
        }
    });
}
var eu_groups = {
    "GUE/NGL": "#df73be",
    "S&D": "#ec2335",
    "Verts/ALE": "#67bd1b",
    "ALDE": "#f1cb01",
    "EFD": "#60c0e2",
    "PPE": "blue",
    "EPP": "blue",
    "ECR": "darkblue",
    "NA/NI": "grey",
    "Array": "pink"
};
var scoreCard = function(list_votes) {
    var votes = function(all) {
        this.all = all;
        this.index = {};
        this.mepindex = {};
        this.type = {
            1: "for",
            "-1": "against",
            0: "abstention",
            "X": "absent",
            "": "not an MEP at the time of this vote"
        };
        this.direction = {
            1: "up",
            "-1": "down"
        };
        _.each(all, function(v, i) {
            v.pro = v.against = v.abstention = v.absent = v["not an MEP at the time of this vote"] = 0;
            v.date = new Date(v.date);
            if (typeof v.dbid !== "undefined") {
                this.index[v.dbid] = i;
            }
        }, this);
    };
    votes.prototype.get = function(id) {
        if (this.index[id])
            return this.all[this.index[id]];
        return null;
    }
    votes.prototype.setRollCall = function(rolls) {
        this.rollcalls = rolls;
        _.each(rolls, function(v, i) {
            var mep = v;
            this.mepindex[v.mep] = i;
            _.each(this.all, function(vote, id) {
                ++vote[this.type[mep[vote.dbid]]];
            }, this);
        }, this);
        var max = 0,
            min = Infinity;
        _.each(this.all, function(vote) {
            vote.cast = vote.pro + vote.against + vote.abstention;
            vote.weight = Math.abs(vote.cast / (vote.against - vote.pro));
            if (min > vote.weight) min = vote.weight;
            if (max < vote.weight) max = vote.weight;
        }, this);
        _.each(this.all, function(vote) {
            vote.weight = 1 + (vote.weight - min) / (max - min);
            vote.weight = 1;
        }, this);
    }
    votes.prototype.getEffort = function(mepid) {
        var effort = 0;
        nbvote = 0;
        if (!this.exists(mepid)) {
            console || Console.log("mep missing " + mepid);
            return 0;
        }
        var mep = this.rollcalls[this.mepindex[mepid]];
        _.each(this.all, function(vote) {
            if (mep[vote.dbid]) {
                ++nbvote;
                if (Math.abs(mep[vote.dbid]) == 1)
                    ++effort;
                if (mep[vote.dbid] == 0) ++effort;
            }
        }, this);
        return effort / nbvote * 100;
    }
    votes.prototype.exists = function(mepid) {
        return this.mepindex.hasOwnProperty(mepid);
    }
    votes.prototype.getVotes = function(mepid) {
        if (!this.exists(mepid)) {
            console || console.log("mep missing " + mepid);
            return {};
        }
        return this.rollcalls[this.mepindex[mepid]];
    }
    votes.prototype.getScore = function(mepid) {
        var score = nbvote = 0;
        if (!this.mepindex[mepid]) {
            console || console.log("mep missing " + mepid);
            return 50;
        }
        var mep = this.rollcalls[this.mepindex[mepid]];
        _.each(this.all, function(vote) {
            if (mep[vote.dbid]) {
                nbvote = nbvote + vote.weight;
                if (mep[vote.dbid] == "X") {
                    return;
                }
                score = score + vote.recommendation * mep[vote.dbid] * vote.weight;
            }
        }, this);
        if (nbvote == 0)
            return 50;
        return Math.floor(50 + 100 * (score / nbvote) / 2); // from 0 to 100
    }
    var vote = new votes(list_votes);
    var tpl = _.template("<div style='background-color:<%= color %>;' class='mep' data-id='<%= epid %>' data-score='<%= score %>'><h2 title='MEP from <%= country %> in <%= eugroup %>'><%= first_name %> <%= last_name.formatName() %></h2><div><img class='lazy-load' dsrc='blank.gif' data-original='http://www.europarl.europa.eu/mepphoto/<%= epid %>.jpg' alt='<%= last_name %>, <%= first_name %> member of <%= eugroup %>' title='MEP from <%= country %> in <%= eugroup %>' width=170 height=216 /><% if (twitter) { %><div class='twitter' data-twitter='<%= twitter %>'></div><% } %><div class='score' style='font-size:<%= size %>px;'><%= score %></div></div><div class='party'><%= party %></div></div>");
    var tplGroup = function(d) {
        return "<div class='dc-grid-group nodc-grid-item country_" + getCountryKey(d.key) + "'><h1 class='dc-grid-label'>" + d.key + "</h1></div>";
    };
    var getMEP = function(id) {
        for (var i in meps) {
            if (meps[i].epid === id)
                return meps[i];
        }
    }

    function grid(selector) {
        adjust(meps);
        ndx = crossfilter(meps);
        var all = ndx.groupAll();

        function getScore(mep) {
            return vote.getScore(mep.epid);
        }
        var color = d3.scale.linear().clamp(true).domain([0, 49, 50, 51, 100]).range(["#CF1919", "#FA9B9B", "#ccc", "#d0e5cc", "#2C851C"]).interpolate(d3.interpolateHcl);

        function adjust(data) {
            var dateFormat = d3.time.format("%Y-%m-%d");
            var now = Date.now();
            var empty = [];
            data.forEach(function(e, i) {
                if (!vote.exists(e.epid)) {
                    empty.unshift(i);
                }
            });
            empty.forEach(function(i) {
                meps.splice(i, 1);
            });
            data.forEach(function(e, i) {
                e.effort = vote.getEffort(e.epid);
                e.scores = [getScore(e), getScore(e), getScore(e), getScore(e)];
                e.birthdate = dateFormat.parse(e.birthdate);
                e.age = ~~((now - e.birthdate) / (31557600000)); // 24 * 3600 * 365.25 * 1000
            });
        }
        var chart_age = dc.lineChart(selector + " .age");
        var age = ndx.dimension(function(d) {
            if (typeof d.age == "undefined") return "";
            return d.age;
        });
        var ageGroup = age.group().reduceSum(function(d) {
            return 1;
        });
        chart_age.width(444).height(200).margins({
            top: 0,
            right: 0,
            bottom: 95,
            left: 30
        }).x(d3.scale.linear().domain([20, 100])).brushOn(true).renderArea(true).elasticY(true).yAxisLabel("Number of MEPs").dimension(age).group(ageGroup);
        var pie_gender = dc.pieChart(selector + " .gender").radius(70);
        var gender = ndx.dimension(function(d) {
            if (typeof d.gender == "undefined") return "";
            return d.gender;
        });
        var groupGender = gender.group().reduceSum(function(d) {
            return 1;
        });
        var NameGender = {
            "M": "Male",
            "F": "Female",
            "": "missing data"
        };
        var SymbolGender = {
            "M": "\u2642",
            "F": "\u2640",
            "": ""
        };
        pie_gender.width(140).height(140).dimension(gender).label(function(d) {
            return SymbolGender[d.key];
        }).title(function(d) {
            return NameGender[d.key] + ": " + d.value;
        }).group(groupGender);
        var score = ndx.dimension(function(d) {
            return d.scores[0];
        });
        var scoreGroup = score.group().reduceSum(function(d) {
            return 1;
        });
        var bar_score = dc.barChart(".bar_score").width(245).height(130).outerPadding(5).gap(0).margins({
            top: 10,
            right: 10,
            bottom: 20,
            left: 30
        }).x(d3.scale.linear().domain([0, 101])).elasticY(true).yAxisLabel("Number of MEPs").round(dc.round.floor).colorCalculator(function(d, i) {
            return color(d.key);
        }).dimension(score).group(scoreGroup).renderlet(function(chart) {
            if (!console || !console.log) return;
            var d = chart.dimension().top(Number.POSITIVE_INFINITY);
            var total = nb = 0;
            d.forEach(function(a) {
                ++nb;
                total += a.scores[0];
            });
            if (nb) {
                var avg = total / nb;
                $(".bar_score div#avg_score").text(Math.round(avg));
            } else {
                $(".bar_score div#avg_score").text("");
            }
            if (ndx.size() !== nb) {
                $(".resetall").attr("disabled", false);
                ga && ga('send', 'event', 'filter', 'subset', nb);
            } else {
                $(".resetall").attr("disabled", true);
                ga && ga('send', 'event', 'filter', 'reset');
            }
        });
        bar_score.yAxis().ticks(4).tickFormat(d3.format(",.0f"));
        bar_country = dc.barChart(selector + " .country");
        var country = ndx.dimension(function(d) {
            if (typeof d.country == "undefined") return "";
            return d.country;
        });
        var countryGroup = country.group().reduce(function(a, d) {
            a.count += 1;
            a.score += d.scores[0];
            return a;
        }, function(a, d) {
            a.count -= 1;
            a.score -= d.scores[0];
            return a;
        }, function() {
            return {
                count: 0,
                score: 0
            };
        });
        bar_country.colorCalculator(function(d, i) {
            return color(d.value.score / d.value.count);
        }).valueAccessor(function(d) {
            return d.value.count;
        }).width(700).height(300).outerPadding(0).gap(1).margins({
            top: 10,
            right: 0,
            bottom: 95,
            left: 30
        }).x(d3.scale.ordinal()).xUnits(dc.units.ordinal).brushOn(false).elasticY(true).yAxisLabel("Number of MEPs").dimension(country).group(countryGroup).on("postRender", function(c) {
            adjustBarChartLabels(c);
            c.svg().selectAll("rect.bar").on("click.scroll", function(d) {
                scrollTo(d.data.key);
            });
        });

        function adjustBarChartLabels(chart) {
            chart.svg().selectAll('.axis.x text').on("click", function(d) {
                chart.filter(d);
                dc.redrawAll();
                scrollTo(d);
            }).style("text-anchor", "end").attr("dx", function(d) {
                return "-0.6em";
            }).attr("dy", function(d) {
                return "-5px";
            });
        }
        partyChart = chartParty(selector, ndx, color);
        chartGroup(selector, ndx, color);
        dc.dataCount(".dc-data-count").dimension(ndx).group(all);
        var name = ndx.dimension(function(d) {
            return d.first_name.toLowerCase() + " " + d.last_name.toLowerCase() + " " + d.party.toLowerCase();
        });
        wall = dc.dataGrid(".dc-data-grid").dimension(name).group(function(d) {
            return d.country;
        }).size(1000).html(function(d) {
            d.score = d.scores[0];
            d.color = color(d.score);
            d.size = 20 + 20 * d.effort / 100;
            return tpl(d);
        }).htmlGroup(function(d) {
            return tplGroup(d);
        }).sortBy(function(d) {
            return d.last_name;
        }).renderlet(function(grid) {
            grid.selectAll(".dc-grid-item").on('click', function(d) {
                MEPpopup(d);
            });
            $("img.lazy-load").lazyload({
                effect: "fadeIn"
            }).removeClass("lazy-load");
        });
        dc.renderAll();
        twitterize();
        hashFilter();
    }

    function hashFilter() {
        var hash = window.location.hash;
        if (hash.indexOf('#party') === 0) {
            var filter = decodeURIComponent(hash.substring(6));
            notice("Show only MEPs from " + filter);
            dc.events.trigger(function() {
                partyChart.filter(filter);
                dc.redrawAll();
                $("#collapseOne").collapse("show");
            }, 2000);
        }
        if (hash.indexOf('#mep') === 0) {
            var mep = getMEP(hash.substring(4));
            MEPpopup(mep);
        } else if (hash.length == 3) {
            var iso = hash.substring(1);
        }
    }

    function MEPpopup(d) {
        d.votes = vote.getVotes(d.epid);
        var v = {
            d: vote.all
        };
        _.each(v.d, function(x) {
            x.mep = d.votes[x.dbid];
            x.direction = vote.direction[x.mep];
            if (x.mep == "") {
                x.type = "not an MEP at the time of this vote";
                return;
            }
            if (x.mep == "X") {
                x.type = "absent";
                return;
            } else {
                x.type = vote.type[x.mep * x.recommendation];
            }
        });
        $("#infobox").modal('show');
        $("#infobox_header").html(tplPopup(d));
        $(".infobox_content").html(tplScore(v));
        window.location.hash = "mep" + d.epid;
        $("#twitter").html(tplTwitter(d));
    }

    function getCountryKey(name) {
        return name.replace(/ /g, "_").toLowerCase();
    }
    scrolled = false;

    function scrollTo(id) {
        ga && ga('send', 'event', 'page', 'scroll', id);
        if (scrolled)
            return;
        scrolled = true;
        $("#collapseOne").collapse("show");
        jQuery('html, body').animate({
            scrollTop: jQuery(".country_" + getCountryKey(id)).offset().top
        }, 2000);
    };

    function chartGroup(selector, ndx, color) {
        var chart = dc.pieChart(selector + " .group").innerRadius(20).radius(70);
        var dimension = ndx.dimension(function(d) {
            if (typeof d.eugroup == "undefined") return "";
            return d.eugroup;
        });
        var group = dimension.group().reduce(function(a, d) {
            a.count += 1;
            a.score += d.scores[0];
            a.effort += d.effort;
            return a;
        }, function(a, d) {
            a.count -= 1;
            a.score -= d.scores[0];
            a.effort -= d.effort;
            return a;
        }, function() {
            return {
                count: 0,
                score: 0,
                effort: 0
            };
        }).order(function(p) {
            return p.count
        });
        var tip = d3.tip().attr('class', 'd3-tip').html(function(p) {
            return '<span><h2>' + p.data.key + "</h2><ul>" + "<li>Number of MEPs: " + p.data.value.count + "</li>" + "<li>Average participation: " + Math.floor(p.data.value.effort / p.data.value.count) + "</li>" + "<li>score: " + Math.floor(p.data.value.score / p.data.value.count);
            '</li></ul></span>'
        }).offset([-12, 0])
        chart.width(140).height(140).dimension(dimension).valueAccessor(function(d) {
            return d.value.count;
        }).colorCalculator(function(d, i) {
            return eu_groups[d.key];
        }).group(group).on("postRender", function(c) {
            c.svg().selectAll("path").call(tip).on('mouseover', function(d) {
                tip.attr('class', 'd3-tip animate').show(d)
            }).on('mouseout', function(d) {
                tip.attr('class', 'd3-tip').show(d)
                tip.hide()
            })
        });
    }

    function chartParty(selector, ndx, color) {
        var bubble_party = dc.bubbleChart(selector + " .party");
        var party = ndx.dimension(function(d) {
            if (typeof d.party == "undefined") return "";
            return d.party;
        });
        var tip = d3.tip().attr('class', 'd3-tip').html(function(p) {
            return '<span><h2>' +
                p.key + "</h2><ul>" + "<li>Number of MEPs: " + p.value.count + "</li>" + "<li>Average participation: " + Math.floor(p.value.effort / p.value.count) + "</li>" + "<li>Average score: " + Math.floor(p.value.score / p.value.count);
            '</li></ul></span>'
        }).offset([-12, 0])
        var partyGroup = party.group().reduce(function(a, d) {
            a.count += 1;
            a.score += d.scores[0];
            a.effort += d.effort;
            return a;
        }, function(a, d) {
            a.count -= 1;
            a.score -= d.scores[0];
            a.effort -= d.effort;
            return a;
        }, function() {
            return {
                count: 0,
                score: 0,
                effort: 0
            };
        }).order(function(p) {
            return p.count
        });
        bubble_party.colorCalculator(function(d, i) {
            return color(d.value.score / d.value.count);
        }).valueAccessor(function(d) {
            return d.value.count;
        }).width(460).height(200).margins({
            top: 20,
            right: 20,
            bottom: 20,
            left: 30
        }).yAxisLabel("%Votes attended").dimension(party).group(partyGroup).keyAccessor(function(p) {
            return p.value.score / p.value.count;
        }).valueAccessor(function(p) {
            return p.value.effort / p.value.count;
        }).radiusValueAccessor(function(p) {
            return p.value.count;
        }).x(d3.scale.linear().domain([0, 100])).r(d3.scale.linear().domain([0, 50])).minRadiusWithLabel(15).elasticY(false).yAxisPadding(0).elasticX(false).elasticRadius(false).xAxisPadding(0).maxBubbleRelativeSize(0.15).renderHorizontalGridLines(false).renderVerticalGridLines(true).renderLabel(false).renderTitle(false).on("postRender", function(c) {
            c.svg().selectAll("circle").call(tip).on('click.setHash', function(d) {
                window.location.hash = encodeURIComponent("party" + d.key);
            }).on('mouseover', function(d) {
                tip.attr('class', 'd3-tip animate').show(d)
            }).on('mouseout', function(d) {
                tip.attr('class', 'd3-tip').show(d)
                tip.hide()
            })
        });
        return bubble_party;
    }
    this.vote = vote;
    this.grid = grid;
    return this;
};

function hasHashFilter() {
    var hash = window.location.hash;
    if (hash.indexOf('#mep') === 0)
        return true;
    if (hash.indexOf('#party') === 0)
        return true;
    return false;
}

function notice(message, callback) {
    $("#alert_placeholder").show();
    $("#alert_placeholder span").html(message);
    setTimeout(function() {
        $("#alert_placeholder").fadeOut("slow");
        callback && callback();
    }, 3000);
};

function twitterize() {
    jQuery("body").on("click", ".twitter", function(event) {
        event.preventDefault();
        if (typeof twitterMsg == "undefined")
            var _twitterMsg = "How does @ score of #score compare to the other MEPs? #ep2014";
        else
            var _twitterMsg = twitterMsg;
        var t = $(this).data("twitter");
        var mep = $(this).closest("div.mep");
        var msg = _twitterMsg.replace("@ ", t + " ");
        msg = msg.replace("#score", mep.data("score")) + " " + document.URL.replace(/#.*/, '') + "#mep" + mep.data("id");
        var url = "http://twitter.com/home/?status=";
        window.open(url + encodeURIComponent(msg), "twitter");
        return false;
    });
}
String.prototype.formatName = function() {
    return this.toLowerCase().replace(/(?:^|\s|-)\S/g, function(word) {
        return word.toUpperCase();
    });
}
