/* globals context */
const hre = require('hardhat');
const { expect } = require('chai');
const utils = require('../../../utils');

let roles;
let accessControlRegistry, airnodeTokenPayment;
let airnodeFeeRegistry, requesterAuthorizerWithManager, airnodeRequesterAuthorizerRegistry;
let api3Token;
let airnodeTokenPaymentAdminRoleDescription = 'AirnodeTokenPayment admin';
let requesterAuthorizerWithManagerAdminRoleDescription = 'RequesterAuthorizerWithManager admin';
let airnodeFeeRegistryAdminRoleDescription = 'AirnodeFeeRegistry admin';
let adminRole, paymentTokenPriceSetterRole, airnodeToWhitelistDurationSetterRole, airnodeToPaymentDestinationSetterRole;
let endpointId = utils.generateRandomBytes32();
let endpointPrice;

beforeEach(async () => {
  const accounts = await hre.ethers.getSigners();
  roles = {
    deployer: accounts[0],
    manager: accounts[1],
    oracle: accounts[2],
    airnode: accounts[3],
    requester: accounts[4],
    payer: accounts[5],
    anotherPayer: accounts[6],
    randomPerson: accounts[7],
  };

  // Deploy AccessControlRegistry contract
  const accessControlRegistryFactory = await hre.ethers.getContractFactory('AccessControlRegistry', roles.deployer);
  accessControlRegistry = await accessControlRegistryFactory.deploy();

  // Deploy RequsterAuthorizer contract
  const requesterAuthorizerWithManagerFactory = await hre.ethers.getContractFactory(
    'RequesterAuthorizerWithManager',
    roles.deployer
  );
  requesterAuthorizerWithManager = await requesterAuthorizerWithManagerFactory.deploy(
    accessControlRegistry.address,
    requesterAuthorizerWithManagerAdminRoleDescription,
    roles.manager.address
  );

  // Deploy RequesterAuthorizerRegistry contract
  airnodeRequesterAuthorizerRegistry = await hre.ethers.getContractFactory(
    'AirnodeRequesterAuthorizerRegistry',
    roles.deployer
  );
  airnodeRequesterAuthorizerRegistry = await airnodeRequesterAuthorizerRegistry.deploy();
  airnodeRequesterAuthorizerRegistry
    .connect(roles.deployer)
    .setRequesterAuthorizerWithManager(1, requesterAuthorizerWithManager.address);

  // Deploy AirnodeFeeRegistry contract
  const airnodeFeeRegistryFactory = await hre.ethers.getContractFactory('AirnodeFeeRegistry', roles.deployer);
  airnodeFeeRegistry = await airnodeFeeRegistryFactory.deploy(
    accessControlRegistry.address,
    airnodeFeeRegistryAdminRoleDescription,
    roles.manager.address
  );

  // Deploy MockApi3Token contract
  const api3TokenFactory = await hre.ethers.getContractFactory('MockApi3Token', roles.deployer);
  api3Token = await api3TokenFactory.deploy(roles.deployer.address, roles.payer.address);
  await api3Token
    .connect(roles.payer)
    .transfer(roles.anotherPayer.address, hre.ethers.utils.parseEther((10e6).toString()));

  // Deploy AirnodeTokenPayment contract
  const airnodeTokenPaymentFactory = await hre.ethers.getContractFactory('AirnodeTokenPayment', roles.deployer);
  airnodeTokenPayment = await airnodeTokenPaymentFactory.deploy(
    accessControlRegistry.address,
    airnodeTokenPaymentAdminRoleDescription,
    roles.manager.address,
    airnodeRequesterAuthorizerRegistry.address,
    airnodeFeeRegistry.address,
    api3Token.address
  );

  const managerRootRole = await accessControlRegistry.deriveRootRole(roles.manager.address);

  const requesterAuthorizerWithManagerAdminRole = await requesterAuthorizerWithManager.adminRole();

  adminRole = await airnodeTokenPayment.adminRole();
  paymentTokenPriceSetterRole = await airnodeTokenPayment.paymentTokenPriceSetterRole();
  airnodeToWhitelistDurationSetterRole = await airnodeTokenPayment.airnodeToWhitelistDurationSetterRole();
  airnodeToPaymentDestinationSetterRole = await airnodeTokenPayment.airnodeToPaymentDestinationSetterRole();

  // Grant roles to valid accounts
  await accessControlRegistry.connect(roles.manager).initializeAndGrantRoles(
    [managerRootRole, adminRole, adminRole, adminRole],
    [
      airnodeTokenPaymentAdminRoleDescription,
      await airnodeTokenPayment.PAYMENT_TOKEN_PRICE_SETTER_ROLE_DESCRIPTION(),
      await airnodeTokenPayment.AIRNODE_TO_WHITELIST_DURATION_SETTER_ROLE_DESCRIPTION(),
      await airnodeTokenPayment.AIRNODE_TO_PAYMENT_DESTINATION_SETTER_ROLE_DESCRIPTION(),
    ],
    [
      roles.manager.address, // which will already have been granted the role
      roles.oracle.address,
      roles.airnode.address,
      roles.airnode.address,
    ]
  );
  // Grant `roles.randomPerson` some invalid roles
  await accessControlRegistry
    .connect(roles.manager)
    .initializeAndGrantRoles(
      [managerRootRole, managerRootRole, managerRootRole, managerRootRole],
      [
        Math.random(),
        await airnodeTokenPayment.PAYMENT_TOKEN_PRICE_SETTER_ROLE_DESCRIPTION(),
        await airnodeTokenPayment.AIRNODE_TO_WHITELIST_DURATION_SETTER_ROLE_DESCRIPTION(),
        await airnodeTokenPayment.AIRNODE_TO_PAYMENT_DESTINATION_SETTER_ROLE_DESCRIPTION(),
      ],
      [roles.randomPerson.address, roles.randomPerson.address, roles.randomPerson.address, roles.randomPerson.address]
    );
  // Grant AirnodeTokenPayment contract the whitelist expiration extender role
  await accessControlRegistry
    .connect(roles.manager)
    .initializeAndGrantRoles(
      [managerRootRole, requesterAuthorizerWithManagerAdminRole],
      [
        requesterAuthorizerWithManagerAdminRoleDescription,
        await requesterAuthorizerWithManager.WHITELIST_EXPIRATION_EXTENDER_ROLE_DESCRIPTION(),
      ],
      [roles.manager.address, airnodeTokenPayment.address]
    );

  // Set the default Price to 100
  await airnodeFeeRegistry.connect(roles.manager).setDefaultPrice(hre.ethers.utils.parseEther((100).toString()));

  endpointPrice = await airnodeFeeRegistry.defaultPrice();
});

describe('constructor', function () {
  context('AccessControlRegistry address is not zero', function () {
    context('admin role description string is not empty', function () {
      context('manager address is not zero', function () {
        context('AirnodeRequesterAuthorizerRegistry is not zero', function () {
          context('AirnodeFeeRegistry address is not zero', function () {
            context('payment token address is not zero', function () {
              it('constructs', async function () {
                const airnodeTokenPaymentFactory = await hre.ethers.getContractFactory(
                  'AirnodeTokenPayment',
                  roles.deployer
                );
                airnodeTokenPayment = await airnodeTokenPaymentFactory.deploy(
                  accessControlRegistry.address,
                  airnodeTokenPaymentAdminRoleDescription,
                  roles.manager.address,
                  airnodeRequesterAuthorizerRegistry.address,
                  airnodeFeeRegistry.address,
                  api3Token.address
                );
                expect(await airnodeTokenPayment.accessControlRegistry()).to.equal(accessControlRegistry.address);
                expect(await airnodeTokenPayment.adminRoleDescription()).to.equal(
                  airnodeTokenPaymentAdminRoleDescription
                );
                expect(await airnodeTokenPayment.manager()).to.equal(roles.manager.address);
                expect(await airnodeTokenPayment.airnodeRequesterAuthorizerRegistry()).to.equal(
                  airnodeRequesterAuthorizerRegistry.address
                );
                expect(await airnodeTokenPayment.airnodeFeeRegistry()).to.equal(airnodeFeeRegistry.address);
                expect(await airnodeTokenPayment.paymentTokenAddress()).to.equal(api3Token.address);
              });
            });
            context('payment token address is zero', async function () {
              it('reverts', async function () {
                const airnodeTokenPaymentFactory = await hre.ethers.getContractFactory(
                  'AirnodeTokenPayment',
                  roles.deployer
                );
                airnodeTokenPayment = await expect(
                  airnodeTokenPaymentFactory.deploy(
                    accessControlRegistry.address,
                    airnodeTokenPaymentAdminRoleDescription,
                    roles.manager.address,
                    airnodeRequesterAuthorizerRegistry.address,
                    airnodeFeeRegistry.address,
                    hre.ethers.constants.AddressZero
                  )
                ).to.be.revertedWith('Zero address');
              });
            });
          });
          context('AinodeFeeRegistry address is zero', function () {
            it('reverts', async function () {
              const airnodeTokenPaymentFactory = await hre.ethers.getContractFactory(
                'AirnodeTokenPayment',
                roles.deployer
              );
              airnodeTokenPayment = await expect(
                airnodeTokenPaymentFactory.deploy(
                  accessControlRegistry.address,
                  airnodeTokenPaymentAdminRoleDescription,
                  roles.manager.address,
                  airnodeRequesterAuthorizerRegistry.address,
                  hre.ethers.constants.AddressZero,
                  api3Token.address
                )
              ).to.be.revertedWith('Zero address');
            });
          });
        });
        context('AirnodeRequesterAuthorizerRegistry is zero', function () {
          it('reverts', async function () {
            const airnodeTokenPaymentFactory = await hre.ethers.getContractFactory(
              'AirnodeTokenPayment',
              roles.deployer
            );
            airnodeTokenPayment = await expect(
              airnodeTokenPaymentFactory.deploy(
                accessControlRegistry.address,
                airnodeTokenPaymentAdminRoleDescription,
                roles.manager.address,
                hre.ethers.constants.AddressZero,
                airnodeFeeRegistry.address,
                api3Token.address
              )
            ).to.be.revertedWith('Zero address');
          });
        });
      });
      context('manager address is zero', function () {
        it('reverts', async function () {
          const airnodeTokenPaymentFactory = await hre.ethers.getContractFactory('AirnodeTokenPayment', roles.deployer);
          await expect(
            airnodeTokenPaymentFactory.deploy(
              accessControlRegistry.address,
              airnodeTokenPaymentAdminRoleDescription,
              hre.ethers.constants.AddressZero,
              airnodeRequesterAuthorizerRegistry.address,
              airnodeFeeRegistry.address,
              api3Token.address
            )
          ).to.be.revertedWith('Manager address zero');
        });
      });
    });
    context('admin role description string is empty', function () {
      it('reverts', async function () {
        const airnodeTokenPaymentFactory = await hre.ethers.getContractFactory('AirnodeTokenPayment', roles.deployer);
        await expect(
          airnodeTokenPaymentFactory.deploy(
            accessControlRegistry.address,
            '',
            roles.manager.address,
            airnodeRequesterAuthorizerRegistry.address,
            airnodeFeeRegistry.address,
            api3Token.address
          )
        ).to.be.revertedWith('Admin role description empty');
      });
    });
  });
  context('AccessControlRegistry address is zero', function () {
    it('reverts', async function () {
      const airnodeTokenPaymentFactory = await hre.ethers.getContractFactory('AirnodeTokenPayment', roles.deployer);
      await expect(
        airnodeTokenPaymentFactory.deploy(
          hre.ethers.constants.AddressZero,
          airnodeTokenPaymentAdminRoleDescription,
          roles.manager.address,
          airnodeRequesterAuthorizerRegistry.address,
          airnodeFeeRegistry.address,
          api3Token.address
        )
      ).to.be.revertedWith('ACR address zero');
    });
  });
});

describe('setPaymentTokenPrice', function () {
  context('caller has payment token price setter role (oracle)', function () {
    context('price is valid', function () {
      it('sets the payment token price', async function () {
        let paymentTokenPrice = await airnodeTokenPayment.paymentTokenPrice();
        expect(paymentTokenPrice).to.equal(1);
        await expect(
          airnodeTokenPayment
            .connect(roles.oracle)
            .setPaymentTokenPrice(hre.ethers.utils.parseUnits('7.5', 18).toString())
        )
          .to.emit(airnodeTokenPayment, 'SetPaymentTokenPrice')
          .withArgs(hre.ethers.utils.parseUnits('7.5', 18).toString(), roles.oracle.address);
        paymentTokenPrice = await airnodeTokenPayment.paymentTokenPrice();
        expect(paymentTokenPrice).to.equal(hre.ethers.utils.parseUnits('7.5', 18).toString());
      });
    });
    context('price is not valid', function () {
      it('reverts', async function () {
        await expect(airnodeTokenPayment.connect(roles.oracle).setPaymentTokenPrice(0)).to.be.revertedWith(
          'Invalid token price'
        );
      });
    });
  });
  context('caller does not have payment token price setter role (oracle)', function () {
    it('reverts', async function () {
      await expect(
        airnodeTokenPayment
          .connect(roles.randomPerson)
          .setPaymentTokenPrice(hre.ethers.utils.parseEther((1000).toString()))
      ).to.be.revertedWith('Not payment token price setter');
    });
  });
});

describe('setAirnodeToWhitelistDuration', function () {
  context('caller has Airnode to whitelist duration setter role', function () {
    context('duration is valid', function () {
      it('sets the whitelist duration for the airnode', async function () {
        const weekInSeconds = 7 * 24 * 60 * 60;
        let whitelistDuration = await airnodeTokenPayment.airnodeToWhitelistDuration(roles.airnode.address);
        expect(whitelistDuration).to.equal(0);
        await expect(airnodeTokenPayment.connect(roles.airnode).setAirnodeToWhitelistDuration(weekInSeconds))
          .to.emit(airnodeTokenPayment, 'SetAirnodeToWhitelistDuration')
          .withArgs(weekInSeconds, roles.airnode.address);
        whitelistDuration = await airnodeTokenPayment.airnodeToWhitelistDuration(roles.airnode.address);
        expect(whitelistDuration).to.equal(weekInSeconds);
      });
    });
    context('duration is not valid', function () {
      it('reverts', async function () {
        await expect(airnodeTokenPayment.connect(roles.airnode).setAirnodeToWhitelistDuration(0)).to.be.revertedWith(
          'Invalid duration'
        );
      });
    });
  });
  context('caller does not have Airnode to whitelist duration setter role', function () {
    it('reverts', async function () {
      await expect(
        airnodeTokenPayment.connect(roles.randomPerson).setAirnodeToWhitelistDuration(1000)
      ).to.be.revertedWith('Not Airnode to whitelist duration setter');
    });
  });
});

describe('setAirnodeToWhitelistDuration', function () {
  context('caller has Airnode to whitelist duration setter role', function () {
    context('duration is valid', function () {
      it('sets the whitelist duration for the airnode', async function () {
        const weekInSeconds = 7 * 24 * 60 * 60;
        let whitelistDuration = await airnodeTokenPayment.airnodeToWhitelistDuration(roles.airnode.address);
        expect(whitelistDuration).to.equal(0);
        await expect(airnodeTokenPayment.connect(roles.airnode).setAirnodeToWhitelistDuration(weekInSeconds))
          .to.emit(airnodeTokenPayment, 'SetAirnodeToWhitelistDuration')
          .withArgs(weekInSeconds, roles.airnode.address);
        whitelistDuration = await airnodeTokenPayment.airnodeToWhitelistDuration(roles.airnode.address);
        expect(whitelistDuration).to.equal(weekInSeconds);
      });
    });
    context('duration is not valid', function () {
      it('reverts', async function () {
        await expect(airnodeTokenPayment.connect(roles.airnode).setAirnodeToWhitelistDuration(0)).to.be.revertedWith(
          'Invalid duration'
        );
      });
    });
  });
  context('caller does not have Airnode to whitelist duration setter role', function () {
    it('reverts', async function () {
      await expect(
        airnodeTokenPayment.connect(roles.randomPerson).setAirnodeToWhitelistDuration(1000)
      ).to.be.revertedWith('Not Airnode to whitelist duration setter');
    });
  });
});

describe('setAirnodeToPaymentDestination', function () {
  context('caller has Airnode to payment destination setter role', function () {
    context('payment destination address is valid', function () {
      it('sets the payment destination address for the airnode', async function () {
        let paymentDestination = await airnodeTokenPayment.airnodeToPaymentDestination(roles.airnode.address);
        expect(paymentDestination).to.equal(hre.ethers.constants.AddressZero);
        await expect(airnodeTokenPayment.connect(roles.airnode).setAirnodeToPaymentDestination(roles.airnode.address))
          .to.emit(airnodeTokenPayment, 'SetAirnodeToPaymentDestination')
          .withArgs(roles.airnode.address, roles.airnode.address);
        paymentDestination = await airnodeTokenPayment.airnodeToPaymentDestination(roles.airnode.address);
        expect(paymentDestination).to.equal(roles.airnode.address);
      });
    });
    context('payment destination address is not valid', function () {
      it('reverts', async function () {
        await expect(
          airnodeTokenPayment.connect(roles.airnode).setAirnodeToPaymentDestination(hre.ethers.constants.AddressZero)
        ).to.be.revertedWith('Invalid destination address');
      });
    });
  });
  context('caller does not have Airnode to payment destination setter role', function () {
    it('reverts', async function () {
      await expect(
        airnodeTokenPayment.connect(roles.randomPerson).setAirnodeToPaymentDestination(roles.airnode.address)
      ).to.be.revertedWith('Not Airnode to payment destination setter');
    });
  });
});
