var SHAPES = {
    CIRCLE: 0,
    ELLIPSE: 1,
    LINE: 2,
    ARROW: 3,
    RECTANGLE: 4,
    LABEL: 5
};
var SHAPE_LABELS = ['circle', 'ellipse', 'line', 'arrow', 'rectangle', 'label'];
var SHAPE_PROPS = {
    ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'fill-opacity', 'stroke', 'stroke-width'],
    rectangle: ['x', 'y', 'width', 'height', 'fill', 'fill-opacity', 'stroke', 'stroke-width'],
    line: ['x1', 'x2', 'y1', 'y2', 'stroke', 'stroke-width'],
    label: []
};
var SCENE_TRANSITION = -1;
var visIds  = [];
var scenes  = {};
var widgets = [];
var sceneId;
var drawShape;
var dragElement;

$(function() {
    $(document).ready(function() {
        $('#n3-ui_visDialog').dialog({
            modal: true,
            width: 500,
            buttons: {
                "Save": saveVis
            }
        });
        
        $('#n3-ui_triggerDialog').dialog({
            modal: true,
            autoOpen: false,
            width: 800,
            // height: 400,
            buttons: {
                "Save": saveTriggers
            }
        });
        
        $('#n3-ui_stylesDialog').dialog({
            autoOpen: false,
            width: 400,
            buttons: {
                "Save": saveAnnotation
            }
        });

        $('#n3-ui_widgetDialog').dialog({
            modal: true,
            width: 350,
            autoOpen: false,
            buttons: {
                "Save": addWidget
            }
        });
        
        $('#n3-ui_exportDialog').dialog({
            modal: true,
            autoOpen: false,
            width: 500
        });
        
        $('#n3-ui_side_panel').sortable();
        $('#n3-ui_side_panel').disableSelection();
    });
})

function saveVis() {
    var closeDialog = true;
    var visJs = $('#vis').val();
    // TODO: sanitze visJS
    eval(visJs);
    
    var visArr = visJs.match(/n3\.vis\(('|")(.*?)('|")\)/ig);
    for(var i in visArr) {
        visArr[i].match(/n3\.vis\(('|")(.*?)('|")\)/i);
        var visId = RegExp.$2;
        visIds.push(visId);
        
        var vis = n3.vis(visId);
        if(!vis.stageSelector || !vis.width() || !vis.height()) {
            closeDialog = false;
            alert('Vis "' + visId + '" doesn\'t have a stage set')
            continue;
        }
        
        if(!vis.renderFn) {
            closeDialog = false;
            alert('Vis "' + visId + '" doesn\'t have a render function')
            continue;
        }
        
        $('#n3-ui_stage')           // Need to replace this for other selector types
            .append('<div id="n3-vis_' + visId + '" class="n3-vis_stage" style="width: ' + (vis.width() + 20) + 'px"><div class="infobar"><p>Visualization: ' + visId + '</p><br clear="all" /></div>' + 
                        '<svg id="' + vis.stageSelector.replace('#', '') + '" width="' + vis.width() + 
                            '" height="' + vis.height() + '"></svg></div>');
        
        var stateSettings = '<div class="infobar state_settings">';                    
        for(var stateId in vis.states) {
            var s = vis.states[stateId];
            stateSettings += '<p>' + stateId + ': ' + 
                '<select onchange="setState(\'' + visId + '\',\'' + stateId + '\', $(this).val())" id="n3-ui_state' + stateId + '"><option value="">Select...</option>';
            
            for(var i in s.validValues)
                stateSettings += '<option>' + s.validValues[i] + '</option>';
            
            stateSettings += '</select>';
        }                    
        
        stateSettings += '<p id="n3-vis_' + visId + '-saveState" style="display: none;"><input type="button" value="Save" onclick="saveState(\'' + visId + '\')" /></p><br clear="all" />';
        stateSettings += '</div>';
        $('#n3-vis_' + visId)
            .append(stateSettings)
            
        $('#n3-vis_' + visId + ' .infobar:last').hide();
        
        // Populate state settings into triggers dialog
        var tmpl = $('#n3-ui_triggerTemplate');
        var widget = $('#n3-ui_widgetDialog');
        for(var stateId in vis.states) {
            var className = visId + '_' + stateId;
            var s = vis.states[stateId];
            
            tmpl.find('span.state:first')
                    .find('select.where:first')
                        .append('<option value="' + className + '">' + visId + ': ' + stateId + '</option>');

            widget.find('select[name=state]')
                .append('<option value="' + className + '">' + visId + ': ' + stateId + '</option>');
                        
            tmpl.find('span.state:first')
                    .append('<select class="value ' + className + '" style="display:none;"><option value="">Select value...</option></select>');
         
            for(var i in s.validValues)
                tmpl.find('span.state:first')
                        .find('select.value.' + className)
                            .append('<option>' + s.validValues[i] + '</option>');
        }

        // If there are no states, then render the visualization immediately.
        if(Object.keys(vis.states).length == 0) vis.renderFn();
    }
    // $('#n3-ui_stage').append('<br clear="all" />')
    $('#n3-ui_stage').bind('mousedown', startDrawOrDrag);
    $('#n3-ui_stage').bind('mouseup', endDrawOrDrag);
    
    if(closeDialog)
        $('#n3-ui_visDialog').dialog('close')
}

function editScene(editSceneId) {
    endScene();
    $('.n3-ui_scene' + sceneId).hide();
    
    if(!editSceneId) {
        sceneId = prompt("Enter a scene ID: ");
        sceneId = sceneId.replace(/[^a-zA-Z0-9]/g, '');
        scenes[sceneId] = { id: sceneId, transitions: [] };  
        scenes[sceneId].members = (scenes[sceneId].members == undefined) ? [] : scenes[sceneId].members;
        
        $('#n3-ui_side_panel')
            .append('<div class="scene" id="n3-ui_scene' + sceneId 
                        + '"><div class="scene-header"><span>Currently Editing Scene: ' + sceneId + '</span></div><div class="scene-content"><ul class="members"></ul></div></div>');

        $('#n3-ui_scene' + sceneId)
            .addClass('ui-widget ui-widget-content ui-helper-clearfix ui-corner-all')
            .find('.scene-header')
                .addClass('ui-widget-header ui-corner-all')
                .prepend('<span class="ui-icon ui-icon-toggle ui-icon-minusthick"></span><span class="ui-icon ui-icon-edit"></span>')
                .end()
            .find('.scene-content');

        $('#n3-ui_scene' + sceneId).find('.scene-header .ui-icon-toggle').click(function() {
            $(this).toggleClass('ui-icon-minusthick').toggleClass('ui-icon-plusthick');
            $(this).parents('.scene:first').find('.scene-content').toggle();

            var mySceneId = $(this).parents('.scene:first').attr('id').replace('n3-ui_scene', '');
            if($(this).hasClass('ui-icon-minusthick'))
                $('.n3-ui_scene' + mySceneId).show();
            else
                $('.n3-ui_scene' + mySceneId).hide();
        });
        
        $('#n3-ui_scene' + sceneId).find('.scene-header .ui-icon-edit').click(function() { 
            var mySceneId = $(this).parents('.scene:first').attr('id').replace('n3-ui_scene', '');
            return editScene(mySceneId); 
        });

        $('#n3-ui_scene' + sceneId + ' .members').sortable({
            stop: reorderMembers
        });  
        
        $('<p class="transitions"><span class="member-text">Scene Transitions</span> <a href="#" title="Edit Scene Transitions" class="ui-icon ui-icon-trigger ui-icon-trigger-empty" onclick="editTriggers(-1);"></a></p>').insertAfter('#n3-ui_scene' + sceneId + ' .members')
        $('#n3-ui_actionsTmpl').find('.then select[name=scene] option[value=new]').before('<option>' + sceneId + '</option>');
    } else {        
        sceneId = editSceneId;
        
        $('.n3-ui_scene' + sceneId).show();
        $('#n3-ui_scene' + sceneId).find('.scene-content').show();
        $('#n3-ui_scene' + sceneId).find('.scene-header span').text('Currently Editing Scene: ' + sceneId);
        $('#n3-ui_scene' + sceneId).find('.scene-header .ui-icon')
                                    .removeClass('ui-icon-plusthick')
                                    .addClass('ui-icon-minusthick');        
    }
    
    $('.state_settings').show();
    $('#n3-ui_startScene').hide();
    $('#n3-ui_endScene').show();
    $('#n3-ui_palette').show();
    
    $('body').css('backgroundColor', '#ddd');
}

function endScene() {
    endDrawOrDrag();
    $('#n3-ui_palette a').removeClass('selected');
    
    $('.state_settings').hide();
    $('#n3-ui_startScene').show();
    $('#n3-ui_endScene').hide();  
    $('#n3-ui_palette').hide();
    $('body').css('backgroundColor', '#fff');  
    
    $('#n3-ui_scene' + sceneId).find('.scene-content').hide();
    $('#n3-ui_scene' + sceneId).find('.scene-header span').text('Scene: ' + sceneId);
    $('#n3-ui_scene' + sceneId).find('.scene-header .ui-icon')
                                .removeClass('ui-icon-minusthick')
                                .addClass('ui-icon-plusthick');
}

function setState(visId, stateId, value) {   
    n3.vis(visId).state(stateId, value);
    $('#' + visId).show();
    $('#n3-vis_' + visId + '-saveState').effect("highlight", {}, 2000);
}

function saveState(visId) {
    for(var stateId in n3.vis(visId).states) {
        
        var m = {
            visId: visId,
            state: {
                id: stateId,
                value: n3.vis(visId).state(stateId)
            }
        };

        populateMember(m);      
    }
    
    $('#n3-vis_' + visId + '-saveState').hide();
}

function populateMember(m, memberIndex) {
    // Give each member an ID if it doesn't point it doesn't already have one
    m.memberId = (m.annotation != null) ? m.annotation.id : 'state_' + uniqueId();
    
    if(arguments.length == 1) 
        memberIndex = scenes[sceneId].members.length;

    if(m.annotation != null) {
        var props = SHAPE_PROPS[SHAPE_LABELS[m.annotation.type]];
        props.forEach(function(p) {
            m.annotation[p] = {value: d3.select('#' + m.annotation.id).attr(p) }
        });
    }
    
    scenes[sceneId].members[memberIndex] = m;
    
    var content;
    var isState = m.state != null;
    
    if(isState)
        content = '<li id="n3-ui_' + m.memberId + '" class="ui-state-default member state"><span class="ui-icon ui-icon-draggable"></span><span class="member-text">' + 
                            m.state.id + '<br />&rarr; &nbsp;' + m.state.value + '</span>';
    else
        content = '<li id="n3-ui_' + m.memberId + '"  class="ui-state-default member annotation"><span class="ui-icon ui-icon-draggable"></span><span class="member-text">' + 
                            'annotation<br />&rarr; &nbsp;#' + m.memberId + '</span>';
    
    content += '<a href="#" title="' + ((m.trigger == null) ? 'Add Triggers' : 'Edit Triggers') + '" class="ui-icon ui-icon-trigger" onclick="editTriggers(' + memberIndex + ');"></a>' + 
               '<a href="#" title="Edit Styles" class="ui-icon ui-icon-style"' + ((!isState) ? ' onclick="showStyles(\'' + m.annotation.id + '\', \'' + m.annotation.type + '\')"' : '') + '></a>' +
               '<a href="#" title="Delete" class="ui-icon ui-icon-delete" onclick="removeMember(' + memberIndex + ');"></a></li>';
        
    $('#n3-ui_scene' + sceneId + ' .members')
        .append(content);
        
    if(m.trigger == null)
        $('#n3-ui_' + m.memberId + ' .ui-icon-trigger').addClass('ui-icon-trigger-empty');
        
    $('#n3-ui_' + m.memberId).hover(function() { $(this).addClass('hover'); }, function() { $(this).removeClass('hover'); })
    
    if(isState)
        $('#n3-ui_' + m.memberId).hover(function() { $('#n3-vis_' + m.visId).addClass('hover'); }, 
                                                function() { $('#n3-vis_' + m.visId).removeClass('hover'); })
    else
        $('#n3-ui_' + m.memberId).hover(function() { d3.select('#' + m.annotation.id).classed('hover', true); }, 
                                                function() { d3.select('#' + m.annotation.id).classed('hover', false); });
}

function removeMember(memberIndex) {    
    var m = scenes[sceneId].members.splice(memberIndex, 1)[0];
    var members = scenes[sceneId].members;
    
    if(m.state != null) {   // If we delete a state, try and find the last prev state
        for(var i = members.length - 1; i >= 0; i--) {
            if(members[i].state != null) {
                n3.vis(members[i].visId).state(members[i].state.id, members[i].state.value);
                $('#n3-ui_state' + members[i].state.id).val(members[i].state.value);
                break;
            }                
        }
    } else {    // If it's an annotation, remove it
        $('#' + m.annotation.id).remove();
    }  
    
    // Repopulate members in the scene
    $('#n3-ui_scene' + sceneId + ' .members').html('');
    for(var i in members)
        populateMember(members[i], i);
}

function reorderMembers(event, ui) {
    var scene = $(ui.item).parents('.scene:first');
    var mySceneId = scene.attr('id').replace('n3-ui_scene', '');
    
    var oldOrder = scenes[sceneId].members;
    scenes[sceneId].members = [];
    
    // We need to clear the scene box and re-draw it for all events to properly register.
    // Probably a better way to register them initially...
    
    var memberOrder = scene.find('li.member');
    // $('#n3-ui_scene' + sceneId + ' .members').html('');
    
    memberOrder.each(function(i, e) {
        var memberId = $(e).attr('id').replace('n3-ui_', '');
        var member = null; 
        
        for(var i in oldOrder) {
            if(oldOrder[i].memberId == memberId) {
                member = oldOrder[i];
                break;
            }
        }
        
        if(member != null)
            scenes[sceneId].members.push(member);
            // populateMember(member)
            
        // Reorder annotations on svg stage
        if(member.annotation != null) {
            var annotation = $('#' + memberId);
            annotation.parents('svg').append(annotation);
        }
    });
}

function editTriggers(memberIndex) {
    var member  = scenes[sceneId].members[memberIndex]; 
    var triggers = member ? [member.trigger] : scenes[sceneId].transitions;
    
    $('#n3-ui_triggerDialog').dialog('option', 'memberIndex', memberIndex);
    $('#n3-ui_triggerDialog').dialog('open');
    $('#n3-ui_actionsTmpl').nextAll('div').remove();
    
    if(!triggers[0] || triggers[0].triggers.length == 0) {
        $('<div class="action">' + $('#n3-ui_actionsTmpl').html() + '</div>').insertBefore('#n3-ui_newTransition');
        $('<p class="trigger">' + $('#n3-ui_triggerTemplate').html() + '</p>').insertBefore('div.action:last .then');
    } else {
        for(var j in triggers) {
            var trigger = triggers[j];
            
            $('<div class="action">' + $('#n3-ui_actionsTmpl').html() + '</div>').insertBefore('#n3-ui_newTransition');
            var action = $('div.action:last');
            
            action.children('.parent').val(trigger.type);
            for(var i in trigger.triggers) {
                var t = trigger.triggers[i];

                $('<p class="trigger">' + $('#n3-ui_triggerTemplate').html() + '</p>').insertBefore('div.action:last .then');
                var p = action.children('p.trigger:eq(' + i + ')');

                p.find('select.trigger_type').val(t.type);
                var typeOpts = p.find('span.' + t.type + ':first');
                typeOpts.find('.where').val(t.where);
                typeOpts.find('.condition').val(t.condition);
                typeOpts.find('.value' + (t.type == 'state' ? '.' + t.where : '')).val(t.value);
                typeOpts.find('.value').hide();
                typeOpts.find('.value' + (t.type == 'state' ? '.' + t.where : '')).show();
                typeOpts.show();

            }    
        }        
    }
    
    $('#n3-ui_triggerDialog').children('div').each(function(i, div) {
        div = $(div);
        --i;
        
        var then = memberIndex == SCENE_TRANSITION ? (triggers[i] ? triggers[i].then : '') : (member.annotation) ? 
                    'then show annotation ' + SHAPE_LABELS[member.annotation.type] : 
                    'then set state ' + member.state.id + ' to ' + member.state.value;

        div.find('.then .member').html(then + '.');        
        div.find('.then select[name=scene]').val(then);
        
        div.find('.then span').hide();
        if(memberIndex == SCENE_TRANSITION) div.find('.then .transition').show();
        else div.find('.then .member').show();
    });
    
    if(memberIndex == SCENE_TRANSITION) $('#n3-ui_newTransition').show();
    else $('#n3-ui_newTransition').hide();
}

function chooseTrigger(trigger) {
    var type = $(trigger).val();
    $(trigger).parent().parent().find('span.trigger_type').hide();
    $(trigger).parent().parent().find('span.' + type).show();
}

function addSubTrigger(type, elem) {
    if(type == SCENE_TRANSITION) {
        $('<div class="action">' + $('#n3-ui_actionsTmpl').html() + '</div>').insertBefore('#n3-ui_newTransition');
        $('#n3-ui_triggerDialog div:last #n3-ui_triggerTemplate').attr('id', '').addClass('trigger').show();
        $('#n3-ui_triggerDialog div:last').find('.then .transition').show();
    }
    else
        $('<p class="trigger">' + $('#n3-ui_triggerTemplate').html() + '</p>').insertAfter($(elem).parent());
}

function newSceneFromTrigger(select) {
    var currentScene = sceneId; 
    
    if($(select).val() == 'new') {
        editScene(); 
        $(select).children('option[value=new]').before('<option>' + sceneId + '</option>');
        $(select).val(sceneId);
        editScene(currentScene);
    }
}

function saveTriggers() {
    var memberIndex = $('#n3-ui_triggerDialog').dialog('option', 'memberIndex');
    var triggerIcon;
    var actions = [];
    
    $('#n3-ui_actionsTmpl').nextAll('div.action').each(function(i, div) {
        var triggers = [];
        div = $(div);
        
        div.children('p.trigger').each(function(i, p) {
            var t = {};

            p = $(p);
            t.type  = p.find('select.trigger_type').val();

            if(t.type != '') {
                var typeOpts = p.find('span.' + t.type + ':first');
                t.where     = typeOpts.find('.where').val();
                t.condition = typeOpts.find('.condition').val();
                t.value     = typeOpts.find('.value' + (t.type == 'state' ? '.' + t.where : '')).val();

                triggers.push(t);

            }       
        });
        
        actions.push({ 
            type: div.find('.parent').val(), 
            triggers: triggers,
            then: ((memberIndex == SCENE_TRANSITION) ? div.find('.then select[name=scene]').val() : undefined)
        });
    })
    
    if(memberIndex == SCENE_TRANSITION) {
        scenes[sceneId].transitions = actions;
        triggerIcon = '#n3-ui_scene' + sceneId + ' .transitions .ui-icon-trigger';   
    } else {
        scenes[sceneId].members[memberIndex].trigger = actions[0];     
        triggerIcon = '#n3-ui_' + scenes[sceneId].members[memberIndex].memberId + ' .ui-icon-trigger';   
    }
    
    if(actions[0].triggers.length == 0)
        $(triggerIcon).addClass('ui-icon-trigger-empty');
    else
        $(triggerIcon).removeClass('ui-icon-trigger-empty');
        
    $('#n3-ui_triggerDialog').dialog('close');
}

function startDomTrigger(button) {
    $('#n3-ui_stage *').bind('mouseenter.dom_trigger', function(e) { $(e.target).addClass('hover') }); 
    $('#n3-ui_stage *').bind('mouseleave.dom_trigger', function(e) { $(e.target).removeClass('hover') });
									
	$('#n3-ui_stage').bind('click.dom_trigger', function(e) {
		$(button).next('input[name=dom_selector]').val($(e.target).getPath());
		
		$('#n3-ui_stage *').unbind('mouseenter.dom_trigger mouseleave.dom_trigger');
		$('#n3-ui_stage').unbind('click.dom_trigger');
		
		$('#n3-ui_triggerDialog').dialog('open');
	});
	
	$('#n3-ui_triggerDialog').dialog('close');	
}

function getStylesDialogMember() {
    var annotation_id = $('#n3-ui_stylesDialog input[name=annotation_id]').val();

    var scene = scenes[sceneId];
    for(var i = 0; i < scene.members.length; i++) {
        if(scene.members[i].memberId == annotation_id)
            return scene.members[i];
    }
}

function showStyles(shapeId, shapeType) {
    var s = d3.select('#' + shapeId);
    var dialog = $('#n3-ui_stylesDialog');
    var shapeLbl = SHAPE_LABELS[shapeType];
    
    dialog.find('input[name=annotation_id]').val(shapeId);
    dialog.find('.specific').hide();
    dialog.find('.' + shapeLbl).show();

    var annotation = getStylesDialogMember().annotation;

    toggleBinding(annotation.bound);
    if(annotation.bound)
        selectRow(annotation.boundIdx);

    dialog.find('.prop').hide();
    var props = SHAPE_PROPS[shapeLbl];
    props.forEach(function(p) {
        bindProp(p, annotation[p].hasOwnProperty('bound'));
        dialog.find('#' + shapeLbl + '_' + p).show();
        dialog.find('#annotation_' + p).show();
    });
    
    $('#n3-ui_stylesDialog').dialog('open')
}

function toggleBinding(bound) {
    var dialog   = $('#n3-ui_stylesDialog');
    var data_tbl = dialog.find('.data_tbl');
    var member = getStylesDialogMember();
    var annotation = member.annotation;

    if(bound) {
        annotation.bound = true;
        dialog.find('input[name=data_tbl]').attr('checked', true);
        dialog.dialog({ width: 500 });
        dialog.dialog({ position: { my: "center", at: "center", of: window }});

        data_tbl.html('<table><thead><tr><th>&nbsp;</th></tr></thead><tbody></tbody></table>');
        var data = n3.vis(member.visId).data();

        Object.keys(data[0]).forEach(function(k) {
            data_tbl.find('tr:first')
                .append('<th>' + k + '</th>');
        });

        data.forEach(function(d, i) {
            data_tbl.find('tbody').append('<tr onclick="selectRow('+i+')"><td><input type="radio" name="data" value="' + i + '" onclick="selectRow(this.value)" /></td></tr>');
            Object.keys(data[0]).forEach(function(k) {
                data_tbl.find('tr:last')
                    .append('<td>' + d[k] + '</td>');
            });        
        });

        dialog.find('select.bindings').each(function(i, s) {
            s = $(s).html('');
            s.append('<option value="">Select...</option>');
            var consts = n3.vis(member.visId).consts;
            for(var c in consts)
                s.append('<option>' + c + '</option>');
        });

        data_tbl.show();
        // data_tbl.find('table').chromatable({ width: 'auto', height: '190px', scrolling: true});
        dialog.find('a.bind').show();
    } else {
        // data_src.attr('disabled', true);
        annotation.bound = false;
        dialog.find('input[name=data_tbl]').attr('checked', false);
        dialog.dialog({ width: 400 });
        dialog.dialog({ position: { my: "center", at: "center", of: window }});
        data_tbl.hide();
        dialog.find('a.bind').hide();
    }
}

function selectRow(i) {
    var data_tbl = $('#n3-ui_stylesDialog .data_tbl table');
    data_tbl.find('tr').removeClass('selected');

    data_tbl.find('tr:eq(' + (i+1) + ')').addClass('selected');
    data_tbl.find('tr:eq(' + (i+1) + ') input').attr('checked', true);

    var annotation = getStylesDialogMember().annotation;
    annotation.boundIdx = i;

    var props = SHAPE_PROPS[SHAPE_LABELS[annotation.type]];
    props.forEach(function(p) {
        updateProp(p, annotation[p].bound || annotation[p].value, annotation[p].hasOwnProperty('bound'));
    });
}

function bindProp(prop, bound) {
    var dialog = $('#n3-ui_stylesDialog');
    var annotation = getStylesDialogMember().annotation;
    var field = dialog.find('#' + SHAPE_LABELS[annotation.type] + '_' + prop);
    if(field.length == 0)
        field = dialog.find('#annotation_' + prop);

    // Toggle binding
    if(bound) {
        field.find('a.bind').addClass('bound');
        field.find('.value').hide();
        field.find('.bindings').val(annotation[prop].bound).show();
    } else {
        field.find('a.bind').removeClass('bound');
        field.find('.value').val(annotation[prop].value).show();
        field.find('.bindings').hide();
    }
}

function updateProp(prop, val, bound) {
    var member = getStylesDialogMember();
    var annotation   = member.annotation;
    var vis = n3.vis(member.visId);
    annotation[prop] = (bound) ? {bound: val} : {value: val};

    if(bound) {
        var type = typeof vis.const(val);
        d3.select('#' + annotation.id)
            .attr(prop, (type == 'function') ? vis.const(val)(vis.data()[annotation.boundIdx]) : vis.const(val));
    } else {
        d3.select('#' + annotation.id)
            .attr(prop, val);
    }
}

function saveAnnotation() {
    $('#n3-ui_stylesDialog').dialog('close');
}

function exportStory() {
    var story = $('#vis').val() + "\n";
    var indent = "        ";

    // Scroll to the top for correct label annotation offsets
    $('#n3-ui_stage').scrollTop(0)
    
    for(var id in scenes) {
        story += "\nn3.scene(" + JSON.stringify(id) + ")\n";
        
        for(var i in scenes[id].members) {
            var member = scenes[id].members[i];
            story += "    ";
            
            if(member.state != null) {
                var val = member.state.value;
                val = typeof(val) == "string" ? JSON.stringify(val) : val;

                story += ".set(" + JSON.stringify(member.visId) + ", " + JSON.stringify(member.state.id) + ", " + val;
            } else {
                var elem = d3.select('#' + member.annotation.id);

                var propVal = function(prop) {
                    var ann = member.annotation;
                    var vis = n3.vis(member.visId);

                    if(ann[prop].hasOwnProperty('bound')) {
                        var val = ann[prop].bound;
                        var type = typeof vis.const(val);
                        return 'function() { var vis = n3.vis(\'' + vis.visId + '\'); return vis.const(\'' + val + '\')' + ((type == 'function') ? '(vis.data()[' + ann.boundIdx + '])' : '') + '}';
                    } else {
                        return ann[prop].value;
                    }
                }
                
                var annotation = "    n3.annotation(" + JSON.stringify(SHAPE_LABELS[member.annotation.type]) + ")\n";
                switch(member.annotation.type) {
                    case SHAPES.CIRCLE:
                        annotation += indent + ".radius(" + propVal('r') + ")\n" +
                                      indent + ".center([" + propVal('cx') + ", " + propVal('cy') + "])\n";
                    break;
                    
                    case SHAPES.ELLIPSE:
                        annotation += indent + ".radius([" + propVal('rx') + ", " + propVal('ry') + "])\n" +
                                      indent + ".center([" + propVal('cx') + ", " + propVal('cy') + "])\n";
                    break;
                    
                    case SHAPES.LINE:
                        annotation += indent + ".start([" + propVal('x1') + ", " + propVal('y1') + "])\n" +
                                      indent + ".end([" + propVal('x2') + ", " + propVal('y2') + "])\n";
                    break;
                    
                    case SHAPES.RECTANGLE:
                        annotation += indent + ".size([" + propVal('width') + ", " + propVal('height') + "])\n" +
                                      indent + ".pos([" + propVal('x') + ", " + propVal('y') + "])\n";
                    break;
                    
                    case SHAPES.LABEL:
                        var svg = $('#n3-vis_' + member.visId + ' svg');
                        var x = parseFloat(elem.style('left')) - svg.offset().left;
                        var y = parseFloat(elem.style('top')) - svg.offset().top;
                    
                        annotation += indent + ".html(" + JSON.stringify(elem.html()) + ")\n" + 
                                      indent + ".pos([" + x + ", " + y + "])\n" + 
                                      indent + ".style('color', " + JSON.stringify(elem.style('color')) + ")" + 
                                      indent + ".style('opacity', " + elem.style('opacity') + ")";;
                    break;
                }
                 
                annotation += indent + ".attr('id', " + JSON.stringify(member.annotation.id) + ")\n";    
                annotation += indent + ".style('fill', " + JSON.stringify(elem.attr('fill') || '#000000') + ")\n";
                annotation += indent + ".style('fill-opacity', '" + (elem.attr('fill-opacity') || '1') + "')\n";
                annotation += indent + ".style('stroke-width', '" + (elem.attr('stroke-width') || '1') + "')\n";
                annotation += indent + ".style('stroke', " + JSON.stringify(elem.attr('stroke') || '#000000') + ")";
                
                story += ".add(" + JSON.stringify(member.visId) + ",\n" + annotation;
            }
            
            if(member.trigger != null) {
                story += ",\n";
                
                story += recursiveExportTrigger(member.trigger);
            }
            
            story += ")\n"
        }
        
        // Treat scene transitions like members too but they're functions
        // and when triggered, they cause a scene change!
        for(var i in scenes[id].transitions) {
            var t = scenes[id].transitions[i];
            
            story += ".add(" + JSON.stringify(member.visId) + ", function() { n3.timeline.switchScene(" + JSON.stringify(t.then) + ") },\n";
            story += recursiveExportTrigger(t);
            story += ")";
        }
    }  
    
    $('#export_js').val(story);  
    $('#export_html').val(exportWidgets());
    $('#n3-ui_exportDialog').dialog('open');
}

// We don't really need something this complex now that we've simplified the trigger UI
// but keep it around just in case!
function recursiveExportTrigger(trigger) {
    var indent = "                    ";
    var story = indent;
    
    switch(trigger.type) {
        case 'or':
        case 'and':
            story += "n3.trigger." + trigger.type + "(\n";

            for(var i in trigger.triggers)
                story += recursiveExportTrigger(trigger.triggers[i]) +
                                ((i == trigger.triggers.length - 1) ? "" : ",\n");

            story += ")\n";
        break;
        
        case 'delay':
            story += 'n3.trigger.afterPrev(' + (trigger.value*1000) + ')';
        break;
        
        case 'state':
            var test = trigger.where.split('_');
        
            story += "n3.trigger(" + JSON.stringify(test[0]) + ")\n" + 
                     indent + ".where(" + JSON.stringify(test[1]) + ")\n" +
                     indent + "." + trigger.condition + "(" + JSON.stringify(trigger.value) + ")"; // Eeks, what about numbers??
        break;
        
        case 'timeline':
            story += "n3.trigger(n3.timeline)\n" +
                     indent + ".where('elapsed')\n" +
                     indent + "." + trigger.condition + "(" + (trigger.value*1000) + ")";
        break;
		
		case 'dom_click':
		case 'dom_dblclick':
		case 'dom_mousedown':
		case 'dom_mouseup':
		case 'dom_mouseover':
		case 'dom_mousemove':
			story += "n3.trigger(" + JSON.stringify(trigger.value) + ").on(" + JSON.stringify(trigger.type.split(/dom_/)[1]) + ")";
		break;
    }
    
    return story;
}

function exportWidgets() {
    var html = '';

    widgets.forEach(function(w) {
        var bound = w.state.split('_');
        var values = n3.vis(bound[0]).states[bound[1]].validValues;

        html += '<p><label>' + bound[1] + ': ';

        if(w.type == 'checkbox')
            html += '<input type="checkbox" onclick="n3.vis(\''+bound[0]+'\').state(\''+bound[1]+'\', this.checked + \'\');" />';
        else if(w.type == 'radio' || w.type == 'select') {
            if(w.type == 'select')
                html += '<select onchange="n3.vis(\''+bound[0]+'\').state(\''+bound[1]+'\', this.value);">';

            values.forEach(function(v) {
                if(w.type == 'radio')
                    html += '</label><label>'+v+': <input name="'+w.state+'" type="radio" value="'+String(v).replace(/\"/g, '\\"')+'" onclick="n3.vis(\''+bound[0]+'\').state(\''+bound[1]+'\', this.value);" />';
                else if(w.type == 'select')
                    html += '<option>' + v + '</option>';
            });

            if(w.type == 'select')
                html += '</select>';
        }
        else if(w.type == 'slider') {
            var min = Math.min.apply(Math, values);
            var max = Math.max.apply(Math, values);
            var step = $('#n3-ui_widgetDialog .slider input[type=number]').val();

            html += '<input type="range" min="'+min+'" max="'+max+'" step="'+step+'" onchange="n3.vis(\''+bound[0]+'\').state(\''+bound[1]+'\', this.value);" />';
        }

        html += '</label></p>\n\n';
    });

    return html;
}

function playStory() {
    // Easy way to grab the n3 js
    exportStory();
    $('#n3-ui_exportDialog').dialog('close');
    
    // N3 doesn't provide an explicit way of ordering scenes, 
    // grab their linear order from the scene boxes
    var sceneOrder = [];
    $('#n3-ui_side_panel .scene').each(function(i, e) {
        sceneOrder.push($(e).attr('id').replace('n3-ui_scene', ''));
    });
    
    var json = {
        visIds: visIds,
        sceneOrder: sceneOrder,
        n3Js: $('#export_js').val(),
        n3Html: $('#export_html').val()
    };
    
    var playWin = window.open('play.html', 'playWin', 'width=1024,height=768,status=yes,menubar=yes,titlebar=yes,toolbar=yes,location=yes,scrollbar=yes');
    var wait = setInterval(function() { 
        playWin.postMessage($.toJSON(json), 'http://' + window.location.host); 
        clearInterval(wait);
    }, 1000);
}

function addWidget() {
    var dialog = $('#n3-ui_widgetDialog');
    widgets.push({
        type: dialog.find('select[name=type]').val(),
        state: dialog.find('select[name=state]').val()
    });

    $('#n3-ui_widget_panel .widgets').html(exportWidgets());
    $('#n3-ui_widget_panel .widgets').find('input, select').attr('disabled', 'true');

    dialog.dialog('close');
}

// Get coordinates of mouse within the svgply
function toggleShape(elem, shapeType) {
    var selected = $(elem).hasClass('selected');
    endDrawOrDrag();
    $('#n3-ui_palette a').removeClass('selected');

    if(!selected) {
        $(elem).addClass('selected');
        drawShape = shapeType;
        $('svg').parent().addClass('draw');
    }
}

function getMouseX(e) {
    var el = e.target;
    while(el != null && el.nodeName.toUpperCase() != 'SVG')
        el = el.parentNode;

    return el != null ? e.clientX - $(el).offset().left : e.pageX;
}

function getMouseY(e) {
    var el = e.target;
    while(el != null && el.nodeName.toUpperCase() != 'SVG')
        el = el.parentNode;
    
    return el != null ? e.clientY - $(el).offset().top : e.pageY;
}

function startDrawOrDrag(e) {
    // If clicked on an svg, this is a draw event
    if(e.target.tagName.toUpperCase() == 'SVG') {
        switch(drawShape) {
            case SHAPES.CIRCLE:
                startCircle(e);
            break;

            case SHAPES.ELLIPSE:
                startEllipse(e);
            break;

            case SHAPES.LINE:
                startLine(e);
            break;

            case SHAPES.RECTANGLE:
                startRect(e);
            break;

            case SHAPES.LABEL:
                startLabel(e);
            break;

        }    

        e.preventDefault();
        e.stopPropagation();    
        return false;    
    } else { // Otherwise, it's a move event
        var el = d3.select(e.target);

        if(el.classed('draggable')) {
            el.attr('startX', getMouseX(e))
              .attr('startY', getMouseY(e));

            dragElement = e.target;            
            $('#n3-ui_stage').bind('mousemove.n3_move', dragAnnotation);
        }
    }

    // if(e.target.tagName.toUpperCase() != 'P') {
    //     // cancel out any text selections
    //     document.body.focus();
    //     // prevent text selection in IE
    //     document.onselectstart = function () { return false; };
    //     // prevent IE from trying to drag an image
    //     e.target.ondragstart = function() { return false; };        
    // }
}

// Called with an arg when finished drawing an individual annotation.
function endDrawOrDrag(e) {
    dragElement = null;
    $('#n3-ui_stage').unbind('mousemove.n3_move');
    $('svg').unbind('mousemove.n3_draw');
    $('svg').unbind('mouseup.n3_draw');
    
    if(e) {
        if(e.data) {
            // When a shape is finished drawing, we want to still
            // allow users to continue to draw more of the selected annotation.
            var m = {
                visId: e.data.visId.replace('n3-vis_', ''),
                annotation: {
                    type: e.data.type,
                    id: e.data.id
                }
            };

            populateMember(m);           
        }
        // 
        // if(e.target != null && e.target.tagName.toUpperCase() != 'P') {
        //     // cancel out any text selections
        //     document.body.focus();
        //     // prevent text selection in IE
        //     document.onselectstart = function () { return false; };
        //     // prevent IE from trying to drag an image
        //     e.target.ondragstart = function() { return false; };        
        // }
    } else {    // End drawing current shape annotation.
        drawShape = -1;
        $('svg').parent().removeClass('draw');
    }
}

function dragAnnotation(e) {
    var el = d3.select(dragElement);
    
    switch(dragElement.tagName.toUpperCase()) {
        case 'ELLIPSE':
            el.attr('cx', getMouseX(e))
              .attr('cy', getMouseY(e))
        break;
        
        case 'RECT':
            var x  = parseInt(el.attr('x')) + (getMouseX(e) - el.attr('startX'));
            var y  = parseInt(el.attr('y')) + (getMouseY(e) - el.attr('startY'));
                    
            el.attr('x', x)
              .attr('y', y)
              .attr('startX', getMouseX(e))
              .attr('startY', getMouseY(e))
        break;
        
        case 'LINE':
            var x1  = parseInt(el.attr('x1')) + (getMouseX(e) - el.attr('startX'));
            var x2  = parseInt(el.attr('x2')) + (getMouseX(e) - el.attr('startX'));
            var y1  = parseInt(el.attr('y1')) + (getMouseY(e) - el.attr('startY'));
            var y2  = parseInt(el.attr('y2')) + (getMouseY(e) - el.attr('startY'));
                 
            el.attr('x1', x1)
              .attr('y1', y1)
              .attr('x2', x2)
              .attr('y2', y2)
              .attr('startX', getMouseX(e))
              .attr('startY', getMouseY(e))
        break;
        
        case 'P':
            el.style('left', e.pageX + $('#n3-ui_stage').scrollLeft() + 'px')
              .style('top', e.pageY + $('#n3-ui_stage').scrollTop() + 'px');
        break;
    }
}

function startCircle(e) {
    var id = 'circle_' + uniqueId();
    
    d3.select(e.target)
        .append('svg:circle')
        .attr('id', id)
        .attr('class', 'draggable n3-ui_scene' + sceneId)
        .attr('cx', getMouseX(e))
        .attr('cy', getMouseY(e))
        .attr('r', 1)
        .attr('fill-opacity', 0)
        .attr('stroke', 'black')
        .attr('stroke-width', 1);
        
    $(e.target).bind('mousemove.n3_draw', { id: id }, drawCircle);
    $(e.target).bind('mouseup.n3_draw', { id: id, visId: e.target.parentNode.id, type: SHAPES.CIRCLE }, endDrawOrDrag);
}

function drawCircle(e) {
    var s = d3.select('#' + e.data.id);    
    var r = Math.sqrt(Math.pow(getMouseX(e) - s.attr('cx'), 2) + Math.pow(getMouseY(e) - s.attr('cy'), 2))
    s.attr('r', r);
}

function startEllipse(e) {
    var id = 'ellipse_' + uniqueId();

    d3.select(e.target)
        .append('svg:ellipse')
        .attr('id', id)
        .attr('class', 'draggable n3-ui_scene' + sceneId)
        .attr('cx', getMouseX(e))
        .attr('cy', getMouseY(e))
        .attr('rx', 1)
        .attr('ry', 1)
        .attr('fill-opacity', 0)
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .style('cursor', 'move');
   
    $(e.target).bind('mousemove.n3_draw', { id: id }, drawEllipse);
    $(e.target).bind('mouseup.n3_draw', { id: id, visId: e.target.parentNode.id, type: SHAPES.ELLIPSE }, endDrawOrDrag);
}

function drawEllipse(e) {
    var s = d3.select('#' + e.data.id);    
    s.attr('rx', Math.abs(getMouseX(e) - s.attr('cx')))
     .attr('ry', Math.abs(getMouseY(e) - s.attr('cy')));
}

function startLine(e) {
    var id = 'line_' + uniqueId();

    d3.select(e.target)
        .append('svg:line')
        .attr('id', id)
        .attr('class', 'draggable n3-ui_scene' + sceneId)
        .attr('x1', getMouseX(e))
        .attr('y1', getMouseY(e))
        .attr('x2', getMouseX(e))
        .attr('y2', getMouseY(e))
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .style('cursor', 'move');
        
    $(e.target).bind('mousemove.n3_draw', { id: id }, drawLine);
    $(e.target).bind('mouseup.n3_draw', { id: id, visId: e.target.parentNode.id, type: SHAPES.LINE }, endDrawOrDrag);
}

function drawLine(e) {
    var s = d3.select('#' + e.data.id);    
    s.attr('x2', getMouseX(e))
     .attr('y2', getMouseY(e));
}

function startRect(e) {
    var id = 'rect_' + uniqueId();
    
    var x = getMouseX(e);
    var y = getMouseY(e);

    d3.select(e.target)
        .append('svg:rect')
        .attr('id', id)
        .attr('class', 'draggable n3-ui_scene' + sceneId)
        .attr('x', x)
        .attr('y', y)
        .attr('width', 1)
        .attr('height', 1)
        .attr('fill-opacity', 0)
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .style('cursor', 'move');
        
    $(e.target).bind('mousemove.n3_draw', { id: id, startX: x, startY: y }, drawRect);   
    $(e.target).bind('mouseup.n3_draw', { id: id, visId: e.target.parentNode.id, type: SHAPES.RECTANGLE }, endDrawOrDrag); 
}

function drawRect(e) {
    var s = d3.select('#' + e.data.id); 
    var startX = e.data.startX;
    var startY = e.data.startY;   
    var mouseX = getMouseX(e);
    var mouseY = getMouseY(e);
    
    // If we start drawing a rect, and then go "backwards"
    // we have to reposition
    if(mouseX < startX)
        s.attr('x', mouseX);
        
    if(mouseY < startY)
        s.attr('y', mouseY);
    
    s.attr('width', Math.abs(mouseX - startX))
     .attr('height', Math.abs(mouseY - startY));
}

function startLabel(e) {
    var id = 'label_' + uniqueId();
    var parent = $(e.target).parent();
    var svg = parent.find('svg');
    
    var x = e.pageX + $('#n3-ui_stage').scrollLeft();
    var y = e.pageY + $('#n3-ui_stage').scrollTop();

    d3.select('#' + parent.attr('id'))
        .append('p')
        .html('Label text')
        .attr('id', id)
        .attr('class', 'draggable editable n3-ui_scene' + sceneId)
        .attr('contenteditable', 'true')
        .style('cursor', 'move')
        .style('color', '#000')
        .style('position', 'absolute')
        .style('left', x + 'px')
        .style('top', y + 'px')
        .style('margin', '0');

    // Labels shouldn't work like normal shapes. You don't add them repetitively because you edit. 
    endDrawOrDrag({ data: { id: id, visId: e.target.parentNode.id, type: SHAPES.LABEL }});
    toggleShape($('#n3-ui_palette a.text')[0], SHAPES.LABEL);
    $('svg').unbind('click.n3_edit');
    
    $('#' + id).focus(function() { $(this).select(); });
}

function uniqueId() {
    return sceneId.substring(0, 5) + '_' + (scenes[sceneId].members.length + 1);
}