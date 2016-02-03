/*
 * Copyright (c) 2016. Teradata Inc.
 */

package com.thinkbiganalytics.nifi;


import com.thinkbiganalytics.controller.MetadataService;
import com.thinkbiganalytics.metadata.MetadataClient;
import org.apache.nifi.annotation.behavior.EventDriven;
import org.apache.nifi.annotation.behavior.InputRequirement;
import org.apache.nifi.annotation.behavior.InputRequirement.Requirement;
import org.apache.nifi.annotation.documentation.CapabilityDescription;
import org.apache.nifi.annotation.documentation.Tags;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.flowfile.FlowFile;
import org.apache.nifi.logging.ProcessorLog;
import org.apache.nifi.processor.AbstractProcessor;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.processor.ProcessSession;
import org.apache.nifi.processor.Relationship;
import org.apache.nifi.processor.exception.ProcessException;
import org.apache.nifi.processor.util.StandardValidators;

import java.util.*;

@EventDriven
@InputRequirement(Requirement.INPUT_REQUIRED)
@Tags({"thinkbig", "registration", "route"})
@CapabilityDescription("Routes depending on whether a registration is required.  Registration is typically one-time setup such as creating permanent tables.")

public class RouteOnRegistration extends AbstractProcessor {

    // Relationships

    public static final Relationship REL_REGISTRATION_REQ = new Relationship.Builder()
            .name("registration_required")
            .description("Registration is required.")
            .build();
    public static final Relationship REL_SUCCESS = new Relationship.Builder()
            .name("success")
            .description("Registration already occurred or not required.")
            .build();
    public static final Relationship REL_FAILURE = new Relationship.Builder()
            .name("failure")
            .description("Unable to determine registration")
            .build();
    private final Set<Relationship> relationships;

    public static final PropertyDescriptor METADATA_SERVICE = new PropertyDescriptor.Builder()
            .name("Metadata Service")
            .description("The Think Big metadata service")
            .required(true)
            .identifiesControllerService(MetadataService.class)
            .build();

    public static final PropertyDescriptor FEED_CATEGORY = new PropertyDescriptor.Builder()
            .name("System Feed Category")
            .description("System category of feed this processor supports")
            .required(true)
            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
            .expressionLanguageSupported(true)
            .build();

    public static final PropertyDescriptor FEED_NAME = new PropertyDescriptor.Builder()
            .name("System Feed Name")
            .description("System name of feed this processor supports")
            .required(true)
            .addValidator(StandardValidators.NON_EMPTY_VALIDATOR)
            .expressionLanguageSupported(true)
            .build();

    private final List<PropertyDescriptor> propDescriptors;

    public RouteOnRegistration() {
        HashSet r = new HashSet();
        r.add(REL_SUCCESS);
        r.add(REL_REGISTRATION_REQ);
        this.relationships = Collections.unmodifiableSet(r);
        ArrayList pds = new ArrayList();
        pds.add(METADATA_SERVICE);
        pds.add(FEED_CATEGORY);
        pds.add(FEED_NAME);
        this.propDescriptors = Collections.unmodifiableList(pds);
    }

    @Override
    public Set<Relationship> getRelationships() {
        return relationships;
    }

    @Override
    protected List<PropertyDescriptor> getSupportedPropertyDescriptors() {
        return propDescriptors;
    }

    @Override
    public void onTrigger(final ProcessContext context, final ProcessSession session) throws ProcessException {
        FlowFile incoming = session.get();
        FlowFile outgoing = (incoming == null ? session.create() : incoming);
        ProcessorLog logger = getLogger();

        final MetadataService metadataService = context.getProperty(METADATA_SERVICE).asControllerService(MetadataService.class);
        final String categoryName = context.getProperty(FEED_CATEGORY).evaluateAttributeExpressions(outgoing).getValue();
        final String feedName = context.getProperty(FEED_NAME).evaluateAttributeExpressions(outgoing).getValue();

        try {
            final MetadataClient client = metadataService.getClient();
            boolean required = client.isRegistrationRequired(categoryName, feedName);

            if (required) {
                session.transfer(outgoing, REL_REGISTRATION_REQ);
            } else {
                session.transfer(outgoing, REL_SUCCESS);
            }

        } catch (final Exception e) {
            logger.error("Routing to registration required. Unable to determine registration status. Failed to route on registration due to {}", new Object[]{incoming, e});
            session.transfer(outgoing, REL_REGISTRATION_REQ);
        }
    }

}